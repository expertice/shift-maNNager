import { prisma } from '../lib/prisma';
import { ChangeHistory, ChangeType } from '@prisma/client';

export interface LogChangeParams {
  scheduleId: string;
  userId?: string;
  employeeId?: string;
  tableName: string;
  recordId: string;
  changeType: ChangeType;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
}

/**
 * Получить историю изменений для схемы
 */
export async function getScheduleHistory(
  scheduleId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  items: ChangeHistory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const pageSize = limit;
  const page = Math.floor(offset / limit) + 1;

  const [items, total] = await Promise.all([
    prisma.changeHistory.findMany({
      where: { scheduleId },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.changeHistory.count({
      where: { scheduleId },
    }),
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
 * Записать изменение в историю
 */
export async function logChange(params: LogChangeParams): Promise<ChangeHistory> {
  // Получаем последнюю версию для определения следующего номера версии
  const lastChange = await prisma.changeHistory.findFirst({
    where: { scheduleId: params.scheduleId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (lastChange?.version || 0) + 1;

  return prisma.changeHistory.create({
    data: {
      scheduleId: params.scheduleId,
      userId: params.userId,
      employeeId: params.employeeId,
      tableName: params.tableName,
      recordId: params.recordId,
      changeType: params.changeType,
      oldValue: params.oldValue ? (params.oldValue as any) : undefined,
      newValue: params.newValue ? (params.newValue as any) : undefined,
      reason: params.reason,
      version: nextVersion,
    },
  });
}

/**
 * Middleware для логирования изменений (можно использовать в контроллерах)
 */
export function logScheduleChange(
  scheduleId: string,
  tableName: string,
  recordId: string,
  changeType: ChangeType,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  userId?: string,
  employeeId?: string,
  reason?: string
): Promise<ChangeHistory> {
  return logChange({
    scheduleId,
    userId,
    employeeId,
    tableName,
    recordId,
    changeType,
    oldValue,
    newValue,
    reason,
  });
}

