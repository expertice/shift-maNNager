import { prisma } from '../lib/prisma';
import { Schedule, ScheduleStatus } from '@prisma/client';
import { validateSchedule } from './laborLawComplianceService.js';

export interface CreateScheduleData {
  ownerUserId: string;
  ownerEmail?: string; // Email пользователя из токена для создания, если пользователя нет
  name: string;
  startDate: Date;
  endDate: Date;
  status?: ScheduleStatus;
}

export interface UpdateScheduleData {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ScheduleStatus;
  reportingPeriod?: 'week' | 'month' | 'quarter' | 'year';
  patternStartOffset?: number;
}

export interface ScheduleWithDetails extends Schedule {
  permissions: unknown[];
  departments: unknown[];
  employees: unknown[];
  shifts: unknown[];
  conflicts: unknown[];
  shiftAssignments: unknown[];
  vacationRules?: unknown;
  vacationAllocations?: unknown[];
  calendarEvents: unknown[];
  workHourTracking: unknown[];
  changeHistory: unknown[];
}

/**
 * Получить список схем для пользователя
 */
export async function getSchedulesForUser(
  userId: string,
  page: number = 1,
  pageSize: number = 20,
  status?: string
): Promise<{
  items: Schedule[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const skip = (page - 1) * pageSize;

  const where: {
    OR: Array<{
      ownerUserId: string;
    } | {
      permissions: {
        some: {
          userId: string;
        };
      };
    }>;
    status?: ScheduleStatus;
  } = {
    OR: [
      { ownerUserId: userId },
      {
        permissions: {
          some: {
            userId,
          },
        },
      },
    ],
  };

  if (status && ['draft', 'published', 'completed', 'archived'].includes(status)) {
    where.status = status as ScheduleStatus;
  }

  const [items, total] = await Promise.all([
    prisma.schedule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.schedule.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Получить схему по ID с проверкой доступа
 */
export async function getScheduleById(
  scheduleId: string,
  userId?: string
): Promise<ScheduleWithDetails | null> {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      permissions: true,
      departments: true,
      positions: true,
      employees: {
        include: {
          department: true,
          position: true,
        },
      },
      // Экземпляры паттернов для строк ростера
      rosterPatternInstances: {
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              tabNumber: true,
            },
          },
          pattern: true,
        },
      },
      shifts: {
        include: {
          employee: true,
          shiftType: true,
        },
      },
      conflicts: true,
      shiftAssignments: {
        include: {
          shiftProfile: true,
          employeeAssignments: {
            include: {
              employee: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      vacationRules: true,
      vacationAllocations: true,
      calendarEvents: true,
      workHourTracking: true,
      changeHistory: {
        take: 50,
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!schedule) {
    return null;
  }

  // Проверка доступа (если userId передан)
  if (userId) {
    const hasAccess =
      schedule.ownerUserId === userId ||
      schedule.permissions.some((p) => p.userId === userId);

    if (!hasAccess) {
      return null;
    }
  }

  return schedule as ScheduleWithDetails;
}

/**
 * Создать новое расписание
 */
export async function createSchedule(data: CreateScheduleData): Promise<Schedule> {
  // Проверяем существование пользователя
  let user = await prisma.user.findUnique({
    where: { id: data.ownerUserId },
  });

  // Если пользователя нет, но есть email, пытаемся найти по email
  if (!user && data.ownerEmail) {
    user = await prisma.user.findUnique({
      where: { email: data.ownerEmail },
    });
    
    // Если нашли по email, но ID не совпадает - это ошибка
    if (user && user.id !== data.ownerUserId) {
      throw new Error(`Пользователь с email ${data.ownerEmail} существует, но ID не совпадает. Пожалуйста, войдите заново.`);
    }
  }

  // Если пользователя все еще нет, выбрасываем ошибку
  if (!user) {
    throw new Error(
      `Пользователь с ID ${data.ownerUserId} не найден в базе данных. ` +
      `Пожалуйста, убедитесь, что вы зарегистрированы и вошли в систему.`
    );
  }

  return prisma.schedule.create({
    data: {
      ownerUserId: user.id, // Используем ID из базы данных
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status || 'draft',
    },
  });
}

/**
 * Обновить расписание
 */
export async function updateSchedule(
  scheduleId: string,
  data: UpdateScheduleData,
  userId?: string
): Promise<Schedule | null> {
  // Проверка доступа
  if (userId) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        permissions: true,
      },
    });

    if (!schedule) {
      return null;
    }

    const hasAccess =
      schedule.ownerUserId === userId ||
      schedule.permissions.some((p) => p.userId === userId && p.role !== 'viewer');

    if (!hasAccess) {
      throw new Error('Access denied');
    }
  }

  const updated = await prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
      ...(data.reportingPeriod !== undefined && { reportingPeriod: data.reportingPeriod }),
      ...(data.patternStartOffset !== undefined && { patternStartOffset: data.patternStartOffset }),
    },
  });

  // Запускаем проверку ТК РФ для расписаний в статусе draft
  if (updated.status === 'draft') {
    // Асинхронно запускаем валидацию (не блокируем ответ)
    validateSchedule(scheduleId).catch((error) => {
      console.error('Error validating schedule:', error);
    });
  }

  return updated;
}

/**
 * Удалить расписание
 */
export async function deleteSchedule(
  scheduleId: string,
  userId?: string
): Promise<boolean> {
  // Проверка доступа (только владелец может удалить)
  if (userId) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule || schedule.ownerUserId !== userId) {
      return false;
    }
  }

  await prisma.schedule.delete({
    where: { id: scheduleId },
  });

  return true;
}

/**
 * Создать копию расписания
 */
export async function duplicateSchedule(
  scheduleId: string,
  newName: string,
  userId?: string
): Promise<Schedule | null> {
  // Получаем исходное расписание
  const sourceSchedule = await getScheduleById(scheduleId, userId);

  if (!sourceSchedule) {
    return null;
  }

  // Создаем новое расписание
  const newSchedule = await prisma.schedule.create({
    data: {
      ownerUserId: userId || sourceSchedule.ownerUserId,
      name: newName,
      startDate: sourceSchedule.startDate,
      endDate: sourceSchedule.endDate,
      status: 'draft',
    },
  });

  // Копируем отделы
  if (sourceSchedule.departments.length > 0) {
    await prisma.department.createMany({
      data: (sourceSchedule.departments as Array<{ name: string }>).map((dept) => ({
        scheduleId: newSchedule.id,
        name: dept.name,
      })),
    });
  }

  // TODO: Копировать сотрудников, смены, отпуска и другие связанные данные
  // Это можно реализовать позже при необходимости

  return newSchedule;
}


