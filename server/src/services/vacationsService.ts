import { prisma } from '../lib/prisma';
import { Vacation, VacationStatus } from '@prisma/client';
import * as realtimeService from './realtimeService';
import { detectConflicts } from './conflictsService';
import {
  getVacationRules,
  getEmployeeAllocation,
  getUsedVacationDays,
  checkConcurrentVacationsLimit,
  checkMinContinuousDaysWarning,
} from './vacationRulesService';

export interface CreateVacationData {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  status: VacationStatus;
  createdBy: string;
}

export interface UpdateVacationData {
  startDate?: Date;
  endDate?: Date;
  status?: VacationStatus;
}

/**
 * Получить отпуска для схемы
 */
export async function getVacationsBySchedule(
  scheduleId: string,
  employeeId?: string,
  status?: string
): Promise<Vacation[]> {
  // Если указан конкретный employeeId, используем его напрямую
  if (employeeId) {
    const where: any = {
      employeeId,
    };

    if (status && ['approved', 'pending', 'rejected', 'cancelled'].includes(status)) {
      where.status = status as VacationStatus;
    }

    const vacations = await prisma.vacation.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Ограничиваем поля employee для избежания проблем с сериализацией
    return vacations.map(v => ({
      ...v,
      employee: {
        id: v.employee.id,
        fullName: v.employee.fullName,
        tabNumber: v.employee.tabNumber,
        scheduleId: v.employee.scheduleId,
      },
    })) as Vacation[];
  }

  // Сначала получаем всех сотрудников схемы, затем их отпуска
  const employees = await prisma.employee.findMany({
    where: { scheduleId },
    select: { id: true },
  });

  const employeeIds = employees.map((e) => e.id);

  // Если нет сотрудников в схеме, возвращаем пустой массив
  if (employeeIds.length === 0) {
    return [];
  }

  const where: any = {
    employeeId: {
      in: employeeIds,
    },
  };

  if (status && ['approved', 'pending', 'rejected', 'cancelled'].includes(status)) {
    where.status = status as VacationStatus;
  }

  const vacations = await prisma.vacation.findMany({
    where,
    include: {
      employee: true,
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  // Ограничиваем поля employee для избежания проблем с сериализацией
  return vacations.map(v => ({
    ...v,
    employee: {
      id: v.employee.id,
      fullName: v.employee.fullName,
      tabNumber: v.employee.tabNumber,
      scheduleId: v.employee.scheduleId,
    },
  })) as Vacation[];
}

/**
 * Создать отпуск с валидацией
 */
const normalizeDateInput = (input: Date | string): Date => {
  const date = input instanceof Date ? input : new Date(input);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const shiftDate = (date: Date, days: number): Date => {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
};

export async function createVacation(data: CreateVacationData): Promise<Vacation> {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
    include: {
      schedule: true,
    },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const scheduleId = employee.scheduleId;

  // Получаем правила отпусков
  const rules = await getVacationRules(scheduleId);

  // Валидация 1: Проверка лимита одновременных отпусков
  if (rules?.maxConcurrentEmployees !== undefined && rules.maxConcurrentEmployees > 0) {
    const concurrentCheck = await checkConcurrentVacationsLimit(
      scheduleId,
      data.startDate,
      data.endDate,
      rules.maxConcurrentEmployees
    );

    if (!concurrentCheck.valid) {
      throw new Error(
        `Превышен лимит одновременных отпусков. На ${concurrentCheck.date?.toLocaleDateString('ru-RU')} уже ${concurrentCheck.count} сотрудников в отпуске (максимум ${rules.maxConcurrentEmployees})`
      );
    }
  }

  // Валидация 2: Проверка выделенных дней на сотрудника
  // Используем год начала расписания, а не год начала отпуска
  const scheduleYear = employee.schedule ? new Date(employee.schedule.startDate).getFullYear() : data.startDate.getFullYear();
  const allocation = await getEmployeeAllocation(scheduleId, data.employeeId, scheduleYear);
  
  // Используем allocation, если есть, иначе используем значение из правил
  const allocatedDays = allocation?.allocatedDays ?? (rules?.availableDays ?? 28);

  if (allocatedDays > 0) {
    const usedDays = await getUsedVacationDays(scheduleId, data.employeeId, scheduleYear);
    
    // Вычисляем количество дней в новом отпуске
    const vacationDays = Math.ceil(
      (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (usedDays + vacationDays > allocatedDays) {
      throw new Error(
        `Превышено выделенное количество дней отпуска. Использовано: ${usedDays}, пытаетесь добавить: ${vacationDays}, доступно: ${allocatedDays}`
      );
    }
  }

  // Валидация 3: Минимальная длина периода - убрана, так как пользователь может создавать отпуска любой длины
  // Проверка будет выполнена после создания отпуска

  // Валидация 4: Период в рамках расписания
  if (employee.schedule) {
    const scheduleStart = new Date(employee.schedule.startDate);
    const scheduleEnd = new Date(employee.schedule.endDate);

    if (data.startDate < scheduleStart || data.endDate > scheduleEnd) {
      throw new Error(
        `Период отпуска должен быть в рамках расписания (${scheduleStart.toLocaleDateString('ru-RU')} - ${scheduleEnd.toLocaleDateString('ru-RU')})`
      );
    }
  }

  // Убеждаемся, что даты установлены на начало дня (00:00:00) в локальном времени
  // Если data.startDate уже Date объект, используем его, иначе создаем новый
  const normalizeDateInput = (input: Date | string): Date => {
    const date = input instanceof Date ? input : new Date(input);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  };

  let startDate = normalizeDateInput(data.startDate);
  let endDate = normalizeDateInput(data.endDate);

  const adjacentVacations = await prisma.vacation.findMany({
    where: {
      employeeId: data.employeeId,
      startDate: { lte: shiftDate(endDate, 1) },
      endDate: { gte: shiftDate(startDate, -1) },
    },
  });

  if (adjacentVacations.length > 0) {
    for (const vacation of adjacentVacations) {
      if (vacation.startDate < startDate) {
        startDate = vacation.startDate;
      }
      if (vacation.endDate > endDate) {
        endDate = vacation.endDate;
      }
    }

    await prisma.vacation.deleteMany({
      where: {
        id: {
          in: adjacentVacations.map(v => v.id),
        },
      },
    });
  }

  const vacation = await prisma.vacation.create({
    data: {
      employeeId: data.employeeId,
      startDate: startDate,
      endDate: endDate,
      status: data.status,
      createdBy: data.createdBy,
    },
    include: {
      employee: true,
    },
  });

  // Ограничиваем поля employee для избежания проблем с сериализацией
  const vacationWithLimitedEmployee: Vacation = {
    id: vacation.id,
    employeeId: vacation.employeeId,
    startDate: vacation.startDate,
    endDate: vacation.endDate,
    status: vacation.status,
    createdBy: vacation.createdBy,
    createdAt: vacation.createdAt,
    updatedAt: vacation.updatedAt,
    employee: {
      id: vacation.employee.id,
      fullName: vacation.employee.fullName,
      tabNumber: vacation.employee.tabNumber,
      scheduleId: vacation.employee.scheduleId,
    } as any, // Временно используем any, так как Employee имеет больше полей
  };

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(vacation.employee.scheduleId, 'vacation:added', vacationWithLimitedEmployee);

  // Обнаруживаем конфликты
  await detectConflicts(vacation.employee.scheduleId);

  // Проверяем предупреждение о минимальной длине периода
  // Используем уже объявленную переменную scheduleYear из валидации 2
  const warning = await checkMinContinuousDaysWarning(scheduleId, data.employeeId, scheduleYear);
  
  // Добавляем предупреждение к объекту отпуска (будет использовано в контроллере)
  (vacationWithLimitedEmployee as any).warning = warning.hasWarning ? warning.message : undefined;

  return vacationWithLimitedEmployee;
}

/**
 * Обновить отпуск с валидацией
 */
export async function updateVacation(
  vacationId: string,
  scheduleId: string,
  data: UpdateVacationData
): Promise<Vacation | null> {
  // Проверяем, что отпуск принадлежит сотруднику из схемы
  const vacation = await prisma.vacation.findFirst({
    where: { id: vacationId },
    include: {
      employee: {
        include: {
          schedule: true,
        },
      },
    },
  });

  if (!vacation || vacation.employee.scheduleId !== scheduleId) {
    return null;
  }

  // Определяем даты для валидации (используем новые, если указаны, иначе старые)
  let startDate = normalizeDateInput(data.startDate || vacation.startDate);
  let endDate = normalizeDateInput(data.endDate || vacation.endDate);

  const adjacentVacations = await prisma.vacation.findMany({
    where: {
      employeeId: vacation.employeeId,
      id: { not: vacationId },
      startDate: { lte: shiftDate(endDate, 1) },
      endDate: { gte: shiftDate(startDate, -1) },
    },
  });

  if (adjacentVacations.length > 0) {
    for (const existing of adjacentVacations) {
      if (existing.startDate < startDate) {
        startDate = existing.startDate;
      }
      if (existing.endDate > endDate) {
        endDate = existing.endDate;
      }
    }

    await prisma.vacation.deleteMany({
      where: {
        id: {
          in: adjacentVacations.map(v => v.id),
        },
      },
    });
  }

  // Получаем правила отпусков
  const rules = await getVacationRules(scheduleId);

  // Валидация 1: Проверка лимита одновременных отпусков
  if (rules?.maxConcurrentEmployees !== undefined && rules.maxConcurrentEmployees > 0) {
    const concurrentCheck = await checkConcurrentVacationsLimit(
      scheduleId,
      startDate,
      endDate,
      rules.maxConcurrentEmployees,
      vacationId // Исключаем текущий отпуск из подсчета
    );

    if (!concurrentCheck.valid) {
      throw new Error(
        `Превышен лимит одновременных отпусков. На ${concurrentCheck.date?.toLocaleDateString('ru-RU')} уже ${concurrentCheck.count} сотрудников в отпуске (максимум ${rules.maxConcurrentEmployees})`
      );
    }
  }

  // Валидация 2: Проверка выделенных дней на сотрудника
  // Используем год начала расписания, а не год начала отпуска
  const scheduleYear = vacation.employee.schedule ? new Date(vacation.employee.schedule.startDate).getFullYear() : startDate.getFullYear();
  const allocation = await getEmployeeAllocation(scheduleId, vacation.employeeId, scheduleYear);
  
  // Используем allocation, если есть, иначе используем значение из правил
  const allocatedDays = allocation?.allocatedDays ?? (rules?.availableDays ?? 28);

  if (allocatedDays > 0) {
    const usedDays = await getUsedVacationDays(scheduleId, vacation.employeeId, scheduleYear, vacationId);
    
    // Вычисляем количество дней в обновленном отпуске
    const vacationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (usedDays + vacationDays > allocatedDays) {
      throw new Error(
        `Превышено выделенное количество дней отпуска. Использовано: ${usedDays}, пытаетесь установить: ${vacationDays}, доступно: ${allocatedDays}`
      );
    }
  }

  // Валидация 3: Минимальная длина периода - убрана, так как пользователь может создавать отпуска любой длины
  // Проверка будет выполнена после обновления отпуска

  // Валидация 4: Период в рамках расписания
  if (vacation.employee.schedule) {
    const scheduleStart = new Date(vacation.employee.schedule.startDate);
    const scheduleEnd = new Date(vacation.employee.schedule.endDate);

    if (startDate < scheduleStart || endDate > scheduleEnd) {
      throw new Error(
        `Период отпуска должен быть в рамках расписания (${scheduleStart.toLocaleDateString('ru-RU')} - ${scheduleEnd.toLocaleDateString('ru-RU')})`
      );
    }
  }

  const updatePayload: Record<string, any> = {
    startDate,
    endDate,
  };
  if (data.status) {
    updatePayload.status = data.status;
  }

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: {
      ...updatePayload,
    },
    include: {
      employee: true,
    },
  });

  // Ограничиваем поля employee для избежания проблем с сериализацией
  const updatedWithLimitedEmployee = {
    ...updated,
    employee: {
      id: updated.employee.id,
      fullName: updated.employee.fullName,
      tabNumber: updated.employee.tabNumber,
      scheduleId: updated.employee.scheduleId,
    },
  };

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(scheduleId, 'vacation:updated', updatedWithLimitedEmployee);

  // Обнаруживаем конфликты
  await detectConflicts(scheduleId);

  // Проверяем предупреждение о минимальной длине периода
  // Используем уже объявленную переменную scheduleYear из валидации 2
  const warning = await checkMinContinuousDaysWarning(scheduleId, vacation.employeeId, scheduleYear);
  
  // Добавляем предупреждение к объекту отпуска (будет использовано в контроллере)
  (updatedWithLimitedEmployee as any).warning = warning.hasWarning ? warning.message : undefined;

  return updatedWithLimitedEmployee as Vacation;
}

/**
 * Удалить отпуск
 */
export async function deleteVacation(
  vacationId: string,
  scheduleId: string
): Promise<boolean> {
  // Проверяем, что отпуск принадлежит сотруднику из схемы
  const vacation = await prisma.vacation.findFirst({
    where: { id: vacationId },
    include: {
      employee: {
        select: {
          id: true,
          scheduleId: true,
        },
      },
    },
  });

  if (!vacation || vacation.employee.scheduleId !== scheduleId) {
    return false;
  }

  await prisma.vacation.delete({
    where: { id: vacationId },
  });

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(scheduleId, 'vacation:deleted', { id: vacationId });

  // Обнаруживаем конфликты
  await detectConflicts(scheduleId);

  return true;
}

