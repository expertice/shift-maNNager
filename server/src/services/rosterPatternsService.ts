import { prisma } from '../lib/prisma';
import { RosterPatternInstance } from '@prisma/client';

export async function getInstancesForSchedule(scheduleId: string): Promise<RosterPatternInstance[]> {
  try {
    // Гарантируем наличие экземпляра для каждого сотрудника
    const employees = await prisma.employee.findMany({
      where: { scheduleId },
      select: { id: true },
    });

    const existing = await prisma.rosterPatternInstance.findMany({ where: { scheduleId } });
    const existingSet = new Set(existing.map((e) => e.employeeId));

    const toCreate = employees.filter((e) => !existingSet.has(e.id));
    if (toCreate.length > 0) {
      // Инициализируем пустой sequence длиной 30 (по умолчанию месяц)
      const empty: (string | null)[] = Array.from({ length: 30 }, () => null);
      await prisma.$transaction(
        toCreate.map((e) =>
          prisma.rosterPatternInstance.create({
            data: { scheduleId, employeeId: e.id, startIndex: 0, sequence: empty },
          })
        )
      );
    }

    return prisma.rosterPatternInstance.findMany({
      where: { scheduleId },
      include: {
        pattern: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            tabNumber: true,
          },
        },
      },
      orderBy: { employeeId: 'asc' },
    });
  } catch (error) {
    console.error('Error in getInstancesForSchedule:', error);
    // Если таблица не существует или другая ошибка, возвращаем пустой массив
    return [];
  }
}

export async function updateSequence(
  scheduleId: string,
  employeeId: string,
  sequence: (string | null)[]
): Promise<RosterPatternInstance> {
  return prisma.rosterPatternInstance.update({
    where: { scheduleId_employeeId: { scheduleId, employeeId } },
    data: { sequence },
  });
}

export async function updateStartIndex(
  scheduleId: string,
  employeeId: string,
  startIndex: number
): Promise<RosterPatternInstance> {
  return prisma.rosterPatternInstance.update({
    where: { scheduleId_employeeId: { scheduleId, employeeId } },
    data: { startIndex },
  });
}

export async function lockIndices(
  scheduleId: string,
  employeeId: string,
  indices: number[]
): Promise<RosterPatternInstance> {
  const instance = await prisma.rosterPatternInstance.findUnique({
    where: { scheduleId_employeeId: { scheduleId, employeeId } },
  });
  const prev = (instance?.lockedIndices as number[] | null) ?? [];
  const merged = Array.from(new Set([...prev, ...indices])).sort((a, b) => a - b);
  return prisma.rosterPatternInstance.update({
    where: { scheduleId_employeeId: { scheduleId, employeeId } },
    data: { lockedIndices: merged as any },
  });
}

export async function unlockIndices(
  scheduleId: string,
  employeeId: string,
  indices: number[]
): Promise<RosterPatternInstance> {
  const instance = await prisma.rosterPatternInstance.findUnique({
    where: { scheduleId_employeeId: { scheduleId, employeeId } },
  });
  const prev = (instance?.lockedIndices as number[] | null) ?? [];
  const filtered = prev.filter((i) => !indices.includes(i));
  return prisma.rosterPatternInstance.update({
    where: { scheduleId_employeeId: { scheduleId, employeeId } },
    data: { lockedIndices: filtered as any },
  });
}


