import { addMonths, endOfMonth, startOfMonth } from 'date-fns';

export interface MonthSlice {
  year: number;
  month: number; // 0-11
  daysInMonth: number;
  start: Date; // first day of month
  end: Date;   // last day of month
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function splitPeriodByMonths(start: Date, end: Date): MonthSlice[] {
  const slices: MonthSlice[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= limit) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const startM = startOfMonth(cursor);
    const endM = endOfMonth(cursor);
    slices.push({
      year: y,
      month: m,
      daysInMonth: getDaysInMonth(y, m),
      start: startM,
      end: endM,
    });
    cursor = addMonths(cursor, 1);
  }
  return slices;
}

export function maxDaysAcrossMonths(slices: MonthSlice[]): number {
  return slices.reduce((max, s) => Math.max(max, s.daysInMonth), 0);
}

export type SlotStatus = 'InsidePeriod' | 'OutsideMonth' | 'OutsidePeriod';

export function getSlotStatus(
  dayIndex: number, // 0..maxDays-1
  slice: MonthSlice,
  periodStart: Date,
  periodEnd: Date
): SlotStatus {
  const day = dayIndex + 1; // 1-based day of month
  if (day > slice.daysInMonth) return 'OutsideMonth';
  const date = new Date(slice.year, slice.month, day);
  if (date < periodStart || date > periodEnd) return 'OutsidePeriod';
  return 'InsidePeriod';
}


