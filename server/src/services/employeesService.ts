import { prisma } from '../lib/prisma';
import { Employee } from '@prisma/client';
import { emitRosterUpdateEvent } from './realtimeService';

export interface CreateEmployeeData {
  scheduleId: string;
  departmentId: string;
  fullName: string;
  tabNumber: string;
  positionId?: string;
  birthDate?: Date;
  isHidden?: boolean;
}

export interface UpdateEmployeeData {
  fullName?: string;
  tabNumber?: string;
  positionId?: string;
  birthDate?: Date;
  departmentId?: string;
  isHidden?: boolean;
}

/**
 * Получить сотрудников схемы
 */
export async function getEmployeesBySchedule(scheduleId: string): Promise<Employee[]> {
  return prisma.employee.findMany({
    where: { scheduleId },
    include: {
      department: true,
      position: true,
      restrictions: true,
    },
    // Сортировка отключена - порядок определяется пользователем через DnD
  });
}

/**
 * Создать сотрудника
 */
export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  // Проверяем уникальность табельного номера в пределах расписания
  const existingEmployee = await prisma.employee.findFirst({
    where: {
      scheduleId: data.scheduleId,
      tabNumber: data.tabNumber,
    },
  });

  if (existingEmployee) {
    throw new Error(`Сотрудник с табельным номером ${data.tabNumber} уже существует в этом расписании`);
  }

  const employee = await prisma.employee.create({
    data: {
      scheduleId: data.scheduleId,
      departmentId: data.departmentId,
      positionId: data.positionId,
      fullName: data.fullName,
      tabNumber: data.tabNumber,
      birthDate: data.birthDate,
      isHidden: data.isHidden || false,
      loginId: null, // loginId устанавливается отдельно при необходимости
    },
  });

  // Отправляем real-time событие об обновлении ростера
  emitRosterUpdateEvent(data.scheduleId, 'employee_added', {
    employeeId: employee.id,
    fullName: employee.fullName,
  });

  return employee;
}

/**
 * Обновить сотрудника
 */
export async function updateEmployee(
  employeeId: string,
  scheduleId: string,
  data: UpdateEmployeeData
): Promise<Employee | null> {
  // Если сотрудник скрывается, очищаем его паттерн-инстанс
  if (data.isHidden === true) {
    const instance = await prisma.rosterPatternInstance.findUnique({
      where: {
        scheduleId_employeeId: {
          scheduleId,
          employeeId,
        },
      },
    });

    if (instance) {
      // Очищаем sequence, устанавливаем patternId в null и startIndex в 0
      await prisma.rosterPatternInstance.update({
        where: {
          scheduleId_employeeId: {
            scheduleId,
            employeeId,
          },
        },
        data: {
          patternId: null,
          sequence: [],
          startIndex: 0,
        },
      });
    }
  }
  // Проверяем, что сотрудник принадлежит схеме
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      scheduleId,
    },
  });

  if (!employee) {
    return null;
  }

  // Проверяем уникальность табельного номера, если он изменяется
  if (data.tabNumber && data.tabNumber !== employee.tabNumber) {
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        scheduleId,
        tabNumber: data.tabNumber,
        id: { not: employeeId },
      },
    });

    if (existingEmployee) {
      throw new Error(`Сотрудник с табельным номером ${data.tabNumber} уже существует в этом расписании`);
    }
  }

  const updatedEmployee = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.tabNumber && { tabNumber: data.tabNumber }),
      ...(data.positionId !== undefined && { positionId: data.positionId }),
      ...(data.birthDate !== undefined && { birthDate: data.birthDate }),
      ...(data.departmentId && { departmentId: data.departmentId }),
      ...(data.isHidden !== undefined && { isHidden: data.isHidden }),
    },
  });

  // Отправляем real-time событие об обновлении ростера
  emitRosterUpdateEvent(scheduleId, 'employee_updated', {
    employeeId,
    changes: data,
  });

  return updatedEmployee;
}

/**
 * Удалить сотрудника
 */
export async function deleteEmployee(
  employeeId: string,
  scheduleId: string
): Promise<boolean> {
  // Проверяем, что сотрудник принадлежит схеме
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      scheduleId,
    },
  });

  if (!employee) {
    return false;
  }

  await prisma.employee.delete({
    where: { id: employeeId },
  });

  // Отправляем real-time событие об обновлении ростера
  emitRosterUpdateEvent(scheduleId, 'employee_deleted', {
    employeeId,
    fullName: employee.fullName,
  });

  return true;
}

export interface CreatePlaceholdersData {
  scheduleId: string;
  departmentId?: string | null;
  count: number;
}

/**
 * Создать болванчиков-сотрудников
 */
export async function createPlaceholders(data: CreatePlaceholdersData): Promise<Employee[]> {
  const { scheduleId, departmentId, count } = data;

  // Получаем максимальный табельный номер для генерации следующих
  const lastEmployee = await prisma.employee.findFirst({
    where: { scheduleId },
    orderBy: { tabNumber: 'desc' },
  });

  let nextTabNumber = 1;
  if (lastEmployee) {
    const lastTabNum = parseInt(lastEmployee.tabNumber, 10);
    if (!isNaN(lastTabNum)) {
      nextTabNumber = lastTabNum + 1;
    }
  }

  const employees: Employee[] = [];

  for (let i = 0; i < count; i++) {
    const employee = await prisma.employee.create({
      data: {
        scheduleId,
        departmentId: departmentId || null,
        fullName: `Сотрудник ${nextTabNumber + i}`,
        tabNumber: String(nextTabNumber + i),
        loginId: null, // loginId устанавливается отдельно при необходимости
        isPlaceholder: true,
      },
    });
    employees.push(employee);
  }

  return employees;
}

/**
 * Клонировать сотрудника
 */
export async function cloneEmployee(
  employeeId: string,
  scheduleId: string
): Promise<Employee | null> {
  // Проверяем, что сотрудник принадлежит схеме
  const sourceEmployee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      scheduleId,
    },
    include: {
      restrictions: true,
    },
  });

  if (!sourceEmployee) {
    return null;
  }

  // Генерируем уникальный табельный номер для клона
  const baseTabNumber = sourceEmployee.tabNumber;
  let newTabNumber = `${baseTabNumber}_копия`;
  let counter = 1;

  // Проверяем уникальность табельного номера
  while (true) {
    const existing = await prisma.employee.findFirst({
      where: {
        scheduleId,
        tabNumber: newTabNumber,
      },
    });

    if (!existing) {
      break;
    }

    counter++;
    newTabNumber = `${baseTabNumber}_копия${counter}`;
  }

  // Создаем клона
  const clonedEmployee = await prisma.employee.create({
    data: {
      scheduleId: sourceEmployee.scheduleId,
      departmentId: sourceEmployee.departmentId,
      positionId: sourceEmployee.positionId,
      fullName: `${sourceEmployee.fullName} (копия)`,
      tabNumber: newTabNumber,
      birthDate: sourceEmployee.birthDate,
      loginId: null, // loginId не копируем
      isPlaceholder: sourceEmployee.isPlaceholder,
    },
  });

  // Копируем ограничения, если они есть
  if (sourceEmployee.restrictions.length > 0) {
    await prisma.employeeRestriction.createMany({
      data: sourceEmployee.restrictions.map((restriction) => ({
        employeeId: clonedEmployee.id,
        restrictionType: restriction.restrictionType,
        value: restriction.value,
      })),
    });
  }

  return clonedEmployee;
}

/**
 * Назначить профиль смены сотруднику
 */
export async function assignShiftProfile(
  employeeId: string,
  scheduleId: string,
  shiftProfileId: string | null
): Promise<Employee | null> {
  // Проверяем, что сотрудник принадлежит схеме
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      scheduleId,
    },
  });

  if (!employee) {
    return null;
  }

  // Обновляем профиль
  const updatedEmployee = await prisma.employee.update({
    where: { id: employeeId },
    data: { shiftProfileId },
  });

  // Если профиль снят (null), очищаем паттерн-инстанс
  if (shiftProfileId === null) {
    const instance = await prisma.rosterPatternInstance.findUnique({
      where: {
        scheduleId_employeeId: {
          scheduleId,
          employeeId,
        },
      },
    });

    if (instance) {
      // Очищаем sequence, устанавливаем patternId в null и startIndex в 0
      await prisma.rosterPatternInstance.update({
        where: {
          scheduleId_employeeId: {
            scheduleId,
            employeeId,
          },
        },
        data: {
          patternId: null,
          sequence: [],
          startIndex: 0,
        },
      });
    }
  }

  return updatedEmployee;
}

/**
 * Массовое обновление сотрудников
 */
export async function bulkUpdateEmployees(
  employeeIds: string[],
  scheduleId: string,
  data: {
    departmentId?: string;
    positionId?: string;
  }
): Promise<number> {
  // Проверяем, что все сотрудники принадлежат схеме
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
  });

  if (employees.length !== employeeIds.length) {
    throw new Error('Некоторые сотрудники не найдены или не принадлежат этой схеме');
  }

  // Обновляем сотрудников в транзакции
  const updateData: any = {};
  if (data.departmentId !== undefined) {
    updateData.departmentId = data.departmentId || null;
  }
  if (data.positionId !== undefined) {
    updateData.positionId = data.positionId || null;
  }

  const result = await prisma.employee.updateMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
    data: updateData,
  });

  return result.count;
}

/**
 * Массовое удаление сотрудников
 */
export async function bulkDeleteEmployees(
  employeeIds: string[],
  scheduleId: string
): Promise<number> {
  // Проверяем, что все сотрудники принадлежат схеме
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
  });

  if (employees.length !== employeeIds.length) {
    throw new Error('Некоторые сотрудники не найдены или не принадлежат этой схеме');
  }

  // Удаляем сотрудников в транзакции
  const result = await prisma.employee.deleteMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
  });

  return result.count;
}

/**
 * Массовое обновление видимости сотрудников
 */
export async function bulkUpdateEmployeeVisibility(
  employeeIds: string[],
  scheduleId: string,
  isHidden: boolean
): Promise<number> {
  // Проверяем, что все сотрудники принадлежат схеме
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
  });

  if (employees.length !== employeeIds.length) {
    throw new Error('Некоторые сотрудники не найдены или не принадлежат этой схеме');
  }

  // Обновляем видимость сотрудников в транзакции
  const result = await prisma.employee.updateMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
    data: { isHidden },
  });

  return result.count;
}

/**
 * Валидация данных сотрудника
 */
export function validateEmployeeData(data: {
  fullName?: string;
  tabNumber?: string;
  departmentId?: string;
  positionId?: string;
}): void {
  if (data.fullName !== undefined && (!data.fullName || data.fullName.trim() === '')) {
    throw new Error('ФИО не может быть пустым');
  }
  if (data.tabNumber !== undefined && (!data.tabNumber || data.tabNumber.trim() === '')) {
    throw new Error('Табельный номер не может быть пустым');
  }
}

