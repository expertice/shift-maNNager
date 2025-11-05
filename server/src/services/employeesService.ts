import { prisma } from '../lib/prisma';
import { Employee } from '@prisma/client';

export interface CreateEmployeeData {
  scheduleId: string;
  departmentId: string;
  fullName: string;
  tabNumber: string;
  birthDate?: Date;
}

export interface UpdateEmployeeData {
  fullName?: string;
  tabNumber?: string;
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
      restrictions: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  });
}

/**
 * Создать сотрудника
 */
export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  return prisma.employee.create({
    data: {
      scheduleId: data.scheduleId,
      departmentId: data.departmentId,
      fullName: data.fullName,
      tabNumber: data.tabNumber,
      birthDate: data.birthDate,
      loginId: data.tabNumber, // Используем табельный номер как loginId по умолчанию
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

  return prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.tabNumber && { tabNumber: data.tabNumber }),
      ...(data.birthDate && { birthDate: data.birthDate }),
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
        loginId: String(nextTabNumber + i),
        isPlaceholder: true,
      },
    });
    employees.push(employee);
  }

  return employees;
}

