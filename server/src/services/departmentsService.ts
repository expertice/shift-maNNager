import { prisma } from '../lib/prisma';
import { Department } from '@prisma/client';

export interface CreateDepartmentData {
  scheduleId: string;
  name: string;
}

export interface UpdateDepartmentData {
  name?: string;
}

/**
 * Получить отделы схемы
 */
export async function getDepartmentsBySchedule(scheduleId: string): Promise<Department[]> {
  return prisma.department.findMany({
    where: { scheduleId },
    orderBy: {
      name: 'asc',
    },
  });
}

/**
 * Создать отдел
 */
export async function createDepartment(data: CreateDepartmentData): Promise<Department> {
  const trimmedName = data.name.trim();
  
  // Проверяем уникальность названия отдела в пределах расписания
  const existingDepartment = await prisma.department.findFirst({
    where: {
      scheduleId: data.scheduleId,
      name: trimmedName,
    },
  });

  if (existingDepartment) {
    throw new Error(`Отдел "${trimmedName}" уже существует в этом расписании`);
  }

  try {
    return await prisma.department.create({
      data: {
        scheduleId: data.scheduleId,
        name: trimmedName,
      },
    });
  } catch (error: any) {
    // Обработка ошибки уникального ограничения от Prisma
    if (error?.code === 'P2002') {
      throw new Error(`Отдел "${trimmedName}" уже существует в этом расписании`);
    }
    throw error;
  }
}

/**
 * Обновить отдел
 */
export async function updateDepartment(
  departmentId: string,
  scheduleId: string,
  data: UpdateDepartmentData
): Promise<Department | null> {
  // Проверяем, что отдел принадлежит схеме
  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      scheduleId,
    },
  });

  if (!department) {
    return null;
  }

  // Проверяем уникальность названия, если оно изменяется
  if (data.name && data.name.trim() !== department.name) {
    const existingDepartment = await prisma.department.findFirst({
      where: {
        scheduleId,
        name: data.name.trim(),
        id: { not: departmentId },
      },
    });

    if (existingDepartment) {
      throw new Error(`Отдел "${data.name}" уже существует в этом расписании`);
    }
  }

  return prisma.department.update({
    where: { id: departmentId },
    data: {
      ...(data.name && { name: data.name.trim() }),
    },
  });
}

/**
 * Удалить отдел
 */
export async function deleteDepartment(
  departmentId: string,
  scheduleId: string
): Promise<boolean> {
  // Проверяем, что отдел принадлежит схеме
  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      scheduleId,
    },
  });

  if (!department) {
    return false;
  }

  await prisma.department.delete({
    where: { id: departmentId },
  });

  return true;
}

