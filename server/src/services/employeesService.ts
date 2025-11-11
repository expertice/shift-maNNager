import { prisma } from '../lib/prisma';
import { Employee } from '@prisma/client';

export interface CreateEmployeeData {
  scheduleId: string;
  departmentId: string;
  fullName: string;
  tabNumber: string;
  positionId?: string;
  birthDate?: Date;
}

export interface UpdateEmployeeData {
  fullName?: string;
  tabNumber?: string;
  positionId?: string;
  birthDate?: Date;
  departmentId?: string;
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

  return prisma.employee.create({
    data: {
      scheduleId: data.scheduleId,
      departmentId: data.departmentId,
      positionId: data.positionId,
      fullName: data.fullName,
      tabNumber: data.tabNumber,
      birthDate: data.birthDate,
      loginId: null, // loginId устанавливается отдельно при необходимости
    },
  });
}

/**
 * Обновить сотрудника
 */
export async function updateEmployee(
  employeeId: string,
  scheduleId: string,
  data: UpdateEmployeeData
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

  return prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.tabNumber && { tabNumber: data.tabNumber }),
      ...(data.positionId !== undefined && { positionId: data.positionId }),
      ...(data.birthDate !== undefined && { birthDate: data.birthDate }),
      ...(data.departmentId && { departmentId: data.departmentId }),
    },
  });
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
  return prisma.employee.update({
    where: { id: employeeId },
    data: { shiftProfileId },
  });
}

