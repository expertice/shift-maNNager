export function normalizeUtcStart(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
}

export function computePositionInCycle(
  currentDate: Date,
  baseCycleStart: Date,
  cycleLength: number,
  employeeOffset: number
): number {
  if (cycleLength <= 0) return 0;
  const daysFromStart = Math.floor(
    (normalizeUtcStart(currentDate).getTime() - normalizeUtcStart(baseCycleStart).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const basePos = ((daysFromStart % cycleLength) + cycleLength) % cycleLength;
  return (basePos + (employeeOffset || 0)) % cycleLength;
}


