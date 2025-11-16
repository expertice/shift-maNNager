import { prisma } from '../lib/prisma';
import { DailyShift, ShiftStatus } from '@prisma/client';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { validateSchedule } from './laborLawComplianceService.js';
import { normalizeUtcStart, nextDayUtcStart } from '../utils/patternCycle';
import { logger } from '../utils/logger';
import * as rosterSnapshotService from './rosterSnapshotService';

export interface CreateShiftData {
  scheduleId: string;
  employeeId: string;
  date: Date;
  shiftTypeId: string | null;
}

export interface UpdateShiftData {
  shiftTypeId?: string | null;
  status?: ShiftStatus;
  modifiedReason?: string;
}

export interface BulkShiftData {
  employeeId: string;
  date: Date;
  shiftTypeId: string | null;
}

/**
 * Получить смены для схемы
 */
export async function getShiftsBySchedule(
  scheduleId: string,
  startDate?: Date,
  endDate?: Date,
  employeeId?: string
): Promise<DailyShift[]> {
  const where: any = {
    scheduleId,
  };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      // Нормализуем к началу дня в UTC для корректного сравнения с @db.Date
      // Используем локальные компоненты для получения правильной календарной даты,
      // но создаем дату в UTC для корректного сравнения с PostgreSQL DATE
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const day = startDate.getDate();
      const normalizedStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      where.date.gte = normalizedStart;
    }
    if (endDate) {
      // Для включения всего последнего дня используем начало следующего дня в UTC
      const nextDay = addDays(endDate, 1);
      const year = nextDay.getFullYear();
      const month = nextDay.getMonth();
      const day = nextDay.getDate();
      const normalizedEnd = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      where.date.lt = normalizedEnd; // Используем < для включения всего последнего дня
    }
  }

  if (employeeId) {
    where.employeeId = employeeId;
  }

  return prisma.dailyShift.findMany({
    where,
    include: {
      employee: true,
      shiftType: {
        include: {
          shiftProfile: true,
        },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });
}

/**
 * Создать смену
 */
export async function createShift(data: CreateShiftData): Promise<DailyShift> {
  // Если shiftTypeId null, создаем смену со статусом 'cancelled' (выходной)
  // Если shiftTypeId не null, создаем обычную смену со статусом 'scheduled'
  const shift = await prisma.dailyShift.create({
    data: {
      scheduleId: data.scheduleId,
      employeeId: data.employeeId,
      date: data.date,
      shiftTypeId: data.shiftTypeId,
      status: data.shiftTypeId === null ? 'cancelled' : 'scheduled',
    },
    include: {
      employee: true,
      shiftType: true,
    },
  });

  // ВАЖНО: Обновляем снимок ростера асинхронно (не блокируем операцию)
  // Это обеспечивает синхронизацию с VacationMode - ростер отпусков ОДИН-В-ОДИН как ростер смен
  rosterSnapshotService.syncRosterSnapshot(data.scheduleId).catch((error) => {
    logger.error('[createShift] Error updating roster snapshot (async)', {
      scheduleId: data.scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  });

  return shift;
}

/**
 * Создать или обновить смену (upsert)
 */
export async function upsertShift(data: CreateShiftData & { status?: ShiftStatus }): Promise<DailyShift> {
  // Нормализуем дату к началу дня в UTC
  const normalizedDate = startOfDay(data.date);
  const year = normalizedDate.getFullYear();
  const month = normalizedDate.getMonth();
  const day = normalizedDate.getDate();
  const dateUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

  logger.info('[upsertShift] Creating/updating shift in DB', {
    scheduleId: data.scheduleId,
    employeeId: data.employeeId,
    date: dateUTC.toISOString(),
    shiftTypeId: data.shiftTypeId,
    status: data.status,
  });

  const shift = await prisma.dailyShift.upsert({
    where: {
      scheduleId_employeeId_date: {
        scheduleId: data.scheduleId,
        employeeId: data.employeeId,
        date: dateUTC,
      },
    },
    update: {
      shiftTypeId: data.shiftTypeId,
      status: data.status || (data.shiftTypeId === null ? 'cancelled' : 'modified'),
    },
    create: {
      scheduleId: data.scheduleId,
      employeeId: data.employeeId,
      date: dateUTC,
      shiftTypeId: data.shiftTypeId,
      status: data.status || (data.shiftTypeId === null ? 'cancelled' : 'modified'),
    },
    include: {
      employee: true,
      shiftType: true,
    },
  });

  logger.info('[upsertShift] Shift created/updated successfully', {
    shiftId: shift.id,
    scheduleId: shift.scheduleId,
    employeeId: shift.employeeId,
    date: shift.date.toISOString(),
    shiftTypeId: shift.shiftTypeId,
  });

  // ВАЖНО: Обновляем снимок ростера асинхронно (не блокируем операцию)
  // Это обеспечивает синхронизацию с VacationMode - ростер отпусков ОДИН-В-ОДИН как ростер смен
  rosterSnapshotService.syncRosterSnapshot(data.scheduleId).catch((error) => {
    logger.error('[upsertShift] Error updating roster snapshot (async)', {
      scheduleId: data.scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  });

  return shift;
}

/**
 * Обновить смену
 */
export async function updateShift(
  shiftId: string,
  scheduleId: string,
  data: UpdateShiftData
): Promise<DailyShift | null> {
  // Проверяем, что смена принадлежит схеме
  const shift = await prisma.dailyShift.findFirst({
    where: {
      id: shiftId,
      scheduleId,
    },
  });

  if (!shift) {
    return null;
  }

  const updatedShift = await prisma.dailyShift.update({
    where: { id: shiftId },
    data: {
      ...(data.shiftTypeId !== undefined && { shiftTypeId: data.shiftTypeId }),
      ...(data.status && { status: data.status }),
      ...(data.modifiedReason && { modifiedReason: data.modifiedReason }),
    },
    include: {
      employee: true,
      shiftType: true,
    },
  });

  // ВАЖНО: Обновляем снимок ростера асинхронно (не блокируем операцию)
  // Это обеспечивает синхронизацию с VacationMode - ростер отпусков ОДИН-В-ОДИН как ростер смен
  rosterSnapshotService.syncRosterSnapshot(scheduleId).catch((error) => {
    logger.error('[updateShift] Error updating roster snapshot (async)', {
      scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  });

  return updatedShift;
}

/**
 * Массовое создание смен
 */
export async function bulkCreateShifts(
  scheduleId: string,
  shifts: BulkShiftData[]
): Promise<number> {
  // Нормализуем даты к началу дня в UTC для корректного сохранения в БД
  // Используем локальные компоненты даты для получения правильной календарной даты,
  // но создаем дату в UTC, чтобы избежать проблем с часовыми поясами
  // PostgreSQL @db.Date сохраняет только дату (без времени), поэтому важно нормализовать правильно
  const data = shifts.map((shift) => {
    // Получаем компоненты даты в ЛОКАЛЬНОМ часовом поясе (для правильной календарной даты)
    const year = shift.date.getFullYear();
    const month = shift.date.getMonth();
    const day = shift.date.getDate();
    // Создаем дату в UTC на начало дня - это гарантирует правильную дату в БД
    const normalizedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    
    return {
      scheduleId,
      employeeId: shift.employeeId,
      date: normalizedDate,
      shiftTypeId: shift.shiftTypeId,
      status: 'scheduled' as ShiftStatus,
    };
  });

  logger.info('[bulkCreateShifts] START', {
    scheduleId,
    shiftsCount: shifts.length,
    sampleShifts: shifts.slice(0, 3).map(s => ({
      employeeId: s.employeeId,
      date: s.date.toISOString(),
      shiftTypeId: s.shiftTypeId,
    })),
  });

  // Prisma createMany не поддерживает skipDuplicates для всех БД,
  // поэтому делаем через транзакцию
  let result: DailyShift[];
  try {
    result = await prisma.$transaction(
      data.map((shift) =>
        prisma.dailyShift.upsert({
          where: {
            scheduleId_employeeId_date: {
              scheduleId: shift.scheduleId,
              employeeId: shift.employeeId,
              date: shift.date,
            },
          },
          update: shift,
          create: shift,
        })
      ),
      {
        timeout: 30000, // 30 секунд таймаут для больших транзакций
      }
    );
  } catch (error) {
    logger.error('[bulkCreateShifts] ERROR - Transaction failed', {
      scheduleId,
      shiftsCount: shifts.length,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  logger.info('[bulkCreateShifts] SUCCESS - Shifts saved to DB', {
    scheduleId,
    requestedCount: shifts.length,
    savedCount: result.length,
    sampleSavedShifts: result.slice(0, 3).map(s => ({
      id: s.id,
      employeeId: s.employeeId,
      date: s.date.toISOString(),
      shiftTypeId: s.shiftTypeId,
    })),
  });

  // ВАЖНО: Проверяем, что смены действительно сохранены в БД
  const verificationCount = await prisma.dailyShift.count({
    where: {
      scheduleId,
      date: {
        gte: data[0]?.date || new Date(0),
        lte: data[data.length - 1]?.date || new Date(),
      },
    },
  });

  logger.info('[bulkCreateShifts] Verification - Shifts count in DB', {
    scheduleId,
    savedInTransaction: result.length,
    verifiedInDB: verificationCount,
    note: verificationCount !== result.length 
      ? 'WARNING: Count mismatch - some shifts might not be saved correctly'
      : 'OK: All shifts saved correctly',
  });

  // Запускаем проверку ТК РФ для расписаний в статусе draft
  prisma.schedule
    .findUnique({
      where: { id: scheduleId },
      select: { status: true },
    })
    .then((schedule) => {
      if (schedule?.status === 'draft') {
        validateSchedule(scheduleId).catch((error) => {
          console.error('Error validating schedule after bulk shift creation:', error);
        });
      }
    })
    .catch((error) => {
      console.error('Error checking schedule status:', error);
    });

  // ВАЖНО: Обновляем снимок ростера СИНХРОННО после массового создания смен
  // Это обеспечивает синхронизацию с VacationMode - ростер отпусков ОДИН-В-ОДИН как ростер смен
  // Делаем это синхронно, чтобы гарантировать, что транзакция уже закоммичена и смены доступны
  try {
    logger.info('[bulkCreateShifts] Updating roster snapshot synchronously', {
      scheduleId,
      shiftsCount: result.length,
    });
    await rosterSnapshotService.syncRosterSnapshot(scheduleId);
    logger.info('[bulkCreateShifts] Roster snapshot updated successfully', {
      scheduleId,
    });
  } catch (error) {
    logger.error('[bulkCreateShifts] Error updating roster snapshot', {
      scheduleId,
      shiftsCount: result.length,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  }

  return result.length;
}

/**
 * Обменять две смены местами
 */
export async function swapShifts(
  shift1Id: string,
  shift2Id: string,
  scheduleId: string
): Promise<{ shift1: DailyShift; shift2: DailyShift } | null> {
  // Получаем обе смены и проверяем, что они принадлежат схеме
  const [shift1, shift2] = await Promise.all([
    prisma.dailyShift.findFirst({
      where: { id: shift1Id, scheduleId },
    }),
    prisma.dailyShift.findFirst({
      where: { id: shift2Id, scheduleId },
    }),
  ]);

  if (!shift1 || !shift2) {
    return null;
  }

  // Обмениваем местами через транзакцию
  const [updatedShift1, updatedShift2] = await prisma.$transaction([
    prisma.dailyShift.update({
      where: { id: shift1Id },
      data: {
        employeeId: shift2.employeeId,
        shiftTypeId: shift2.shiftTypeId,
        status: 'modified' as ShiftStatus,
        modifiedReason: 'Swapped with another shift',
      },
      include: {
        employee: true,
        shiftType: true,
      },
    }),
    prisma.dailyShift.update({
      where: { id: shift2Id },
      data: {
        employeeId: shift1.employeeId,
        shiftTypeId: shift1.shiftTypeId,
        status: 'modified' as ShiftStatus,
        modifiedReason: 'Swapped with another shift',
      },
      include: {
        employee: true,
        shiftType: true,
      },
    }),
  ]);

  return {
    shift1: updatedShift1,
    shift2: updatedShift2,
  };
}

/**
 * Удалить смену
 */
export async function deleteShift(shiftId: string, scheduleId: string): Promise<boolean> {
  // Проверяем, что смена принадлежит схеме
  const shift = await prisma.dailyShift.findFirst({
    where: {
      id: shiftId,
      scheduleId,
    },
  });

  if (!shift) {
    return false;
  }

  await prisma.dailyShift.delete({
    where: { id: shiftId },
  });

  // ВАЖНО: Обновляем снимок ростера асинхронно (не блокируем операцию)
  // Это обеспечивает синхронизацию с VacationMode - ростер отпусков ОДИН-В-ОДИН как ростер смен
  rosterSnapshotService.syncRosterSnapshot(scheduleId).catch((error) => {
    logger.error('[deleteShift] Error updating roster snapshot (async)', {
      scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  });

  return true;
}

/**
 * Удалить все смены в указанном периоде для схемы
 */
export async function deleteShiftsByPeriod(
  scheduleId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Используем endOfDay для включения последнего дня полностью
  const end = endOfDay(endDate);
  
  const result = await prisma.dailyShift.deleteMany({
    where: {
      scheduleId,
      date: {
        gte: startDate,
        lte: end,
      },
    },
  });

  try {
    console.info('[deleteShiftsByPeriod]', {
      scheduleId,
      startISO: startDate.toISOString(),
      endISO: end.toISOString(),
      count: result.count,
    });
  } catch {}

  return result.count;
}

/**
 * Удалить все смены сотрудника в указанном периоде
 */
export async function deleteEmployeeShifts(
  scheduleId: string,
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Нормализуем даты к началу дня
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  
  // Используем ту же логику нормализации, что и в generateShiftsFromProfile
  const normalizedStart = normalizeUtcStart(start);
  const normalizedEndExclusive = nextDayUtcStart(end);
  
  const result = await prisma.dailyShift.deleteMany({
    where: {
      scheduleId,
      employeeId,
      date: {
        gte: normalizedStart,
        lt: normalizedEndExclusive,
      },
    },
  });

  try {
    console.info('[deleteEmployeeShifts]', {
      scheduleId,
      employeeId,
      startISO: normalizedStart.toISOString(),
      endExclusiveISO: normalizedEndExclusive.toISOString(),
      count: result.count,
    });
  } catch {}

  return result.count;
}

