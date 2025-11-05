import { ShiftProfilePattern } from '@prisma/client';

export function normalizeUtcStart(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
}

export function nextDayUtcStart(date: Date): Date {
  const base = normalizeUtcStart(date);
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function computePositionInCycle(
  currentDate: Date,
  baseCycleStart: Date,
  cycleLength: number,
  employeeOffset: number
): number {
  const daysFromStart = Math.floor(
    (normalizeUtcStart(currentDate).getTime() - normalizeUtcStart(baseCycleStart).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const basePos = ((daysFromStart % cycleLength) + cycleLength) % cycleLength;
  return (basePos + (employeeOffset || 0)) % cycleLength;
}

export function getSequenceFromPatternOrInstance(
  instanceSequence: (string | null)[] | undefined,
  pattern: ShiftProfilePattern
): (string | null)[] {
  return (instanceSequence as (string | null)[] | undefined) ?? (pattern.sequence as (string | null)[]);
}


