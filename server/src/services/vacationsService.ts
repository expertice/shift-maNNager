import { prisma } from '../lib/prisma';
import { Vacation, VacationStatus } from '@prisma/client';
import * as realtimeService from './realtimeService';
import { detectConflicts } from './conflictsService';
import {
  getVacationRules,
  getEmployeeAllocation,
  getUsedVacationDays,
  checkConcurrentVacationsLimit,
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
  // Сначала получаем всех сотрудников схемы, затем их отпуска
  const employees = await prisma.employee.findMany({
    where: { scheduleId },
    select: { id: true },
  });

  const employeeIds = employees.map((e) => e.id);

  const where: any = {
    employeeId: {
      in: employeeIds,
    },
  };

  if (employeeId) {
    where.employeeId = employeeId;
  }

  if (status && ['approved', 'pending', 'rejected', 'cancelled'].includes(status)) {
    where.status = status as VacationStatus;
  }

  return prisma.vacation.findMany({
    where,
    include: {
      employee: true,
    },
    orderBy: {
      startDate: 'asc',
    },
  });
}

/**
 * Создать отпуск с валидацией
 */
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
  if (rules && rules.maxConcurrentEmployees) {
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
  const year = data.startDate.getFullYear();
  const allocation = await getEmployeeAllocation(scheduleId, data.employeeId, year);

  if (allocation && allocation.allocatedDays > 0) {
    const usedDays = await getUsedVacationDays(scheduleId, data.employeeId, year);
    
    // Вычисляем количество дней в новом отпуске
    const vacationDays = Math.ceil(
      (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (usedDays + vacationDays > allocation.allocatedDays) {
      throw new Error(
        `Превышено выделенное количество дней отпуска. Использовано: ${usedDays}, пытаетесь добавить: ${vacationDays}, доступно: ${allocation.allocatedDays}`
      );
    }
  }

  // Валидация 3: Минимальная длина периода
  if (rules && rules.minContinuousDays) {
    const vacationDays = Math.ceil(
      (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (vacationDays < rules.minContinuousDays) {
      throw new Error(
        `Минимальная длина периода отпуска: ${rules.minContinuousDays} дней. Выбранный период: ${vacationDays} дней`
      );
    }
  }

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

  const vacation = await prisma.vacation.create({
    data: {
      employeeId: data.employeeId,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      createdBy: data.createdBy,
    },
    include: {
      employee: true,
    },
  });

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(vacation.employee.scheduleId, 'vacation:added', vacation);

  // Обнаруживаем конфликты
  await detectConflicts(vacation.employee.scheduleId);

  return vacation;
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
  const startDate = data.startDate || vacation.startDate;
  const endDate = data.endDate || vacation.endDate;

  // Получаем правила отпусков
  const rules = await getVacationRules(scheduleId);

  // Валидация 1: Проверка лимита одновременных отпусков
  if (rules && rules.maxConcurrentEmployees) {
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
  const year = startDate.getFullYear();
  const allocation = await getEmployeeAllocation(scheduleId, vacation.employeeId, year);

  if (allocation && allocation.allocatedDays > 0) {
    const usedDays = await getUsedVacationDays(scheduleId, vacation.employeeId, year, vacationId);
    
    // Вычисляем количество дней в обновленном отпуске
    const vacationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (usedDays + vacationDays > allocation.allocatedDays) {
      throw new Error(
        `Превышено выделенное количество дней отпуска. Использовано: ${usedDays}, пытаетесь установить: ${vacationDays}, доступно: ${allocation.allocatedDays}`
      );
    }
  }

  // Валидация 3: Минимальная длина периода
  if (rules && rules.minContinuousDays) {
    const vacationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (vacationDays < rules.minContinuousDays) {
      throw new Error(
        `Минимальная длина периода отпуска: ${rules.minContinuousDays} дней. Выбранный период: ${vacationDays} дней`
      );
    }
  }

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

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: {
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
    },
    include: {
      employee: true,
    },
  });

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(scheduleId, 'vacation:updated', updated);

  // Обнаруживаем конфликты
  await detectConflicts(scheduleId);

  return updated;
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
      employee: true,
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

