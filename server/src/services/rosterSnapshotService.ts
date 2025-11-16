import { prisma } from '../lib/prisma';
import { RosterSnapshot } from '@prisma/client';
import { logger } from '../utils/logger';

export interface RosterSnapshotData {
  employees: any[];
  shiftTypes: any[];
  instances: any[];
  shifts: any[];
  employeeOrder: string[];
}

/**
 * Получить снимок ростера для расписания
 */
export async function getRosterSnapshot(scheduleId: string): Promise<RosterSnapshot | null> {
  return prisma.rosterSnapshot.findUnique({
    where: { scheduleId },
  });
}

/**
 * Синхронизировать снимок ростера с текущими данными из БД
 * Загружает актуальные данные: сотрудников, типы смен, экземпляры паттернов, смены
 */
export async function syncRosterSnapshot(scheduleId: string): Promise<RosterSnapshot> {
  // Загружаем сотрудников
  const employees = await prisma.employee.findMany({
    where: { scheduleId },
    include: {
      department: true,
      position: true,
      shiftProfile: true,
    },
  });

  // Загружаем профили смен и типы смен
  const shiftProfiles = await prisma.shiftProfile.findMany({
    where: { scheduleId },
    include: {
      shiftTypes: true,
    },
  });

  // Извлекаем все типы смен из профилей
  const shiftTypes = shiftProfiles.flatMap((profile) => profile.shiftTypes);

  // Загружаем экземпляры паттернов с их startIndex
  const instances = await prisma.rosterPatternInstance.findMany({
    where: { scheduleId },
    include: {
      pattern: true,
    },
  });

  // ВАЖНО: Загружаем ВСЕ смены для расписания, БЕЗ фильтра по датам
  // Это нужно, потому что паттерны в основании могут смещаться, и смены могут быть за пределами периода расписания
  // Пользователь указал: "хранить все, потому что паттерны в основании могут смещаться"
  
  logger.info('[syncRosterSnapshot] Loading ALL shifts from DB (no date filter)', {
    scheduleId,
    note: 'Loading all shifts for schedule, not filtering by date range - patterns can shift',
  });

  const shifts = await prisma.dailyShift.findMany({
    where: {
      scheduleId,
      // ВАЖНО: НЕ фильтруем по датам - загружаем ВСЕ смены
      // date: { gte: startDate, lte: endDate } - УБРАНО
    },
    include: {
      shiftType: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  logger.info('[syncRosterSnapshot] Shifts loaded from DB', {
    scheduleId,
    shiftsCount: shifts.length,
    note: 'All shifts loaded without date filter',
    sampleShifts: shifts.slice(0, 5).map(s => ({
      id: s.id,
      employeeId: s.employeeId,
      date: s.date instanceof Date ? s.date.toISOString() : s.date,
      shiftTypeId: s.shiftTypeId,
    })),
    dateRange: shifts.length > 0 ? {
      minDate: shifts[0].date instanceof Date ? shifts[0].date.toISOString() : shifts[0].date,
      maxDate: shifts[shifts.length - 1].date instanceof Date 
        ? shifts[shifts.length - 1].date.toISOString() 
        : shifts[shifts.length - 1].date,
    } : null,
  });

  // ВАЖНО: Проверяем, что смены действительно загружены
  if (shifts.length === 0) {
    logger.warn('[syncRosterSnapshot] No shifts found in DB for schedule', {
      scheduleId,
      note: 'No shifts found - this might indicate that shifts were not generated or saved',
    });
  }

  // ВАЖНО: Сериализуем смены в простые объекты для сохранения в JSON
  // Prisma объекты с include могут содержать циклические ссылки и специальные типы (Date, BigInt)
  // которые не сериализуются правильно в JSON поле
  const serializedShifts = shifts.map(shift => ({
    id: shift.id,
    scheduleId: shift.scheduleId,
    employeeId: shift.employeeId,
    date: shift.date instanceof Date ? shift.date.toISOString().split('T')[0] : shift.date,
    shiftTypeId: shift.shiftTypeId,
    status: shift.status,
    createdAt: shift.createdAt instanceof Date ? shift.createdAt.toISOString() : shift.createdAt,
    updatedAt: shift.updatedAt instanceof Date ? shift.updatedAt.toISOString() : shift.updatedAt,
    // Включаем данные shiftType, если они есть
    shiftType: shift.shiftType ? {
      id: shift.shiftType.id,
      name: shift.shiftType.name,
      color: shift.shiftType.color,
      startTime: shift.shiftType.startTime,
      endTime: shift.shiftType.endTime,
      workingHours: shift.shiftType.workingHours,
      nightHoursCount: shift.shiftType.nightHoursCount,
      breaks: shift.shiftType.breaks,
      shiftProfileId: shift.shiftType.shiftProfileId,
    } : null,
  }));

  logger.info('[syncRosterSnapshot] Shifts serialized', {
    scheduleId,
    originalCount: shifts.length,
    serializedCount: serializedShifts.length,
    sampleSerialized: serializedShifts.slice(0, 2),
  });

  // Порядок сотрудников: по умолчанию берем текущий порядок из БД
  const employeeOrder = employees.map((emp) => emp.id);

  logger.info('[syncRosterSnapshot] Creating/updating snapshot', {
    scheduleId,
    employeesCount: employees.length,
    shiftTypesCount: shiftTypes.length,
    instancesCount: instances.length,
    shiftsCount: serializedShifts.length,
    employeeOrderCount: employeeOrder.length,
  });

  // Создаем или обновляем снимок
  const snapshot = await prisma.rosterSnapshot.upsert({
    where: { scheduleId },
    create: {
      scheduleId,
      employees: employees as any,
      shiftTypes: shiftTypes as any,
      instances: instances as any,
      shifts: serializedShifts as any,
      employeeOrder: employeeOrder as any,
    },
    update: {
      employees: employees as any,
      shiftTypes: shiftTypes as any,
      instances: instances as any,
      shifts: serializedShifts as any,
      employeeOrder: employeeOrder as any,
    },
  });

  logger.info('[syncRosterSnapshot] Snapshot created/updated successfully', {
    scheduleId,
    snapshotId: snapshot.id,
    shiftsInSnapshot: Array.isArray(snapshot.shifts) ? (snapshot.shifts as any[]).length : 0,
  });

  return snapshot;
}

/**
 * Обновить снимок ростера с предоставленными данными
 */
export async function updateRosterSnapshot(
  scheduleId: string,
  data: Partial<RosterSnapshotData>
): Promise<RosterSnapshot> {
  const existing = await getRosterSnapshot(scheduleId);

  if (!existing) {
    // Если снимка нет, синхронизируем и затем обновляем
    const synced = await syncRosterSnapshot(scheduleId);
    return prisma.rosterSnapshot.update({
      where: { scheduleId },
      data: {
        ...(data.employees && { employees: data.employees as any }),
        ...(data.shiftTypes && { shiftTypes: data.shiftTypes as any }),
        ...(data.instances && { instances: data.instances as any }),
        ...(data.shifts && { shifts: data.shifts as any }),
        ...(data.employeeOrder && { employeeOrder: data.employeeOrder as any }),
      },
    });
  }

  return prisma.rosterSnapshot.update({
    where: { scheduleId },
    data: {
      ...(data.employees && { employees: data.employees as any }),
      ...(data.shiftTypes && { shiftTypes: data.shiftTypes as any }),
      ...(data.instances && { instances: data.instances as any }),
      ...(data.shifts && { shifts: data.shifts as any }),
      ...(data.employeeOrder && { employeeOrder: data.employeeOrder as any }),
    },
  });
}

/**
 * Обновить только порядок сотрудников в снимке ростера
 */
export async function updateEmployeeOrder(
  scheduleId: string,
  employeeOrder: string[]
): Promise<RosterSnapshot> {
  return updateRosterSnapshot(scheduleId, { employeeOrder });
}

/**
 * Удалить снимок ростера (при удалении расписания это произойдет автоматически через onDelete: Cascade)
 */
export async function deleteRosterSnapshot(scheduleId: string): Promise<void> {
  await prisma.rosterSnapshot.delete({
    where: { scheduleId },
  });
}

