import { prisma } from '../lib/prisma';
import { SchedulePermission, UserRole } from '@prisma/client';

export interface CreatePermissionData {
  scheduleId: string;
  userId: string;
  role: UserRole;
}

/**
 * Получить права доступа для схемы
 */
export async function getSchedulePermissions(
  scheduleId: string
): Promise<SchedulePermission[]> {
  return prisma.schedulePermission.findMany({
    where: { scheduleId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Создать право доступа
 */
export async function createSchedulePermission(
  data: CreatePermissionData
): Promise<SchedulePermission> {
  // Проверяем, что схема существует
  const schedule = await prisma.schedule.findUnique({
    where: { id: data.scheduleId },
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Проверяем, что пользователь существует
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Проверяем, нет ли уже такого права
  const existing = await prisma.schedulePermission.findUnique({
    where: {
      scheduleId_userId: {
        scheduleId: data.scheduleId,
        userId: data.userId,
      },
    },
  });

  if (existing) {
    throw new Error('Permission already exists');
  }

  return prisma.schedulePermission.create({
    data: {
      scheduleId: data.scheduleId,
      userId: data.userId,
      role: data.role,
    },
  });
}

/**
 * Обновить право доступа
 */
export async function updateSchedulePermission(
  permissionId: string,
  scheduleId: string,
  role: UserRole
): Promise<SchedulePermission | null> {
  // Проверяем, что право принадлежит схеме
  const permission = await prisma.schedulePermission.findFirst({
    where: {
      id: permissionId,
      scheduleId,
    },
  });

  if (!permission) {
    return null;
  }

  return prisma.schedulePermission.update({
    where: { id: permissionId },
    data: { role },
  });
}

/**
 * Удалить право доступа
 */
export async function deleteSchedulePermission(
  permissionId: string,
  scheduleId: string
): Promise<boolean> {
  // Проверяем, что право принадлежит схеме
  const permission = await prisma.schedulePermission.findFirst({
    where: {
      id: permissionId,
      scheduleId,
    },
  });

  if (!permission) {
    return false;
  }

  await prisma.schedulePermission.delete({
    where: { id: permissionId },
  });

  return true;
}

