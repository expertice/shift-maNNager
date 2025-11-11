import { prisma } from '../lib/prisma';
import { Position } from '@prisma/client';

export interface CreatePositionData {
  scheduleId: string;
  name: string;
}

export interface UpdatePositionData {
  name?: string;
}

/**
 * Получить должности схемы
 */
export async function getPositionsBySchedule(scheduleId: string): Promise<Position[]> {
  return prisma.position.findMany({
    where: { scheduleId },
    orderBy: {
      name: 'asc',
    },
  });
}

/**
 * Создать должность
 */
export async function createPosition(data: CreatePositionData): Promise<Position> {
  const trimmedName = data.name.trim();
  
  // Проверяем уникальность названия должности в пределах расписания
  const existingPosition = await prisma.position.findFirst({
    where: {
      scheduleId: data.scheduleId,
      name: trimmedName,
    },
  });

  if (existingPosition) {
    throw new Error(`Должность "${trimmedName}" уже существует в этом расписании`);
  }

  try {
    return await prisma.position.create({
      data: {
        scheduleId: data.scheduleId,
        name: trimmedName,
      },
    });
  } catch (error: any) {
    // Обработка ошибки уникального ограничения от Prisma
    if (error?.code === 'P2002') {
      throw new Error(`Должность "${trimmedName}" уже существует в этом расписании`);
    }
    throw error;
  }
}

/**
 * Обновить должность
 */
export async function updatePosition(
  positionId: string,
  scheduleId: string,
  data: UpdatePositionData
): Promise<Position | null> {
  // Проверяем, что должность принадлежит схеме
  const position = await prisma.position.findFirst({
    where: {
      id: positionId,
      scheduleId,
    },
  });

  if (!position) {
    return null;
  }

  // Проверяем уникальность названия, если оно изменяется
  if (data.name && data.name.trim() !== position.name) {
    const existingPosition = await prisma.position.findFirst({
      where: {
        scheduleId,
        name: data.name.trim(),
        id: { not: positionId },
      },
    });

    if (existingPosition) {
      throw new Error(`Должность "${data.name}" уже существует в этом расписании`);
    }
  }

  return prisma.position.update({
    where: { id: positionId },
    data: {
      ...(data.name && { name: data.name.trim() }),
    },
  });
}

/**
 * Удалить должность
 */
export async function deletePosition(
  positionId: string,
  scheduleId: string
): Promise<boolean> {
  // Проверяем, что должность принадлежит схеме
  const position = await prisma.position.findFirst({
    where: {
      id: positionId,
      scheduleId,
    },
  });

  if (!position) {
    return false;
  }

  await prisma.position.delete({
    where: { id: positionId },
  });

  return true;
}

