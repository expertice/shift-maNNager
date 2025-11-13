import { eachDayOfInterval, startOfMonth, endOfMonth, format, startOfYear, endOfYear, isSameDay, isWithinInterval } from 'date-fns';

export interface MonthInfo {
  year: number;
  month: number; // 0-based (0 = January)
  startDate: Date;
  endDate: Date;
  daysInMonth: number;
}

/**
 * Разбить период на месяцы с учетом границ года
 */
export function splitPeriodIntoMonths(startDate: Date, endDate: Date): MonthInfo[] {
  const months: MonthInfo[] = [];
  const current = new Date(startDate);
  current.setDate(1); // Начинаем с первого дня месяца

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);

    // Определяем реальные границы месяца в рамках периода
    const actualStart = monthStart < startDate ? startDate : monthStart;
    const actualEnd = monthEnd > endDate ? endDate : monthEnd;

    months.push({
      year,
      month,
      startDate: actualStart,
      endDate: actualEnd,
      daysInMonth: monthEnd.getDate(),
    });

    // Переходим к следующему месяцу
    current.setMonth(month + 1);
  }

  return months;
}

/**
 * Получить все месяцы года, включая предыдущий и следующий год если период выходит за границы
 */
export function getMonthsForPeriod(startDate: Date, endDate: Date): MonthInfo[] {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Определяем, нужно ли добавлять месяцы предыдущего года
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();

  const months: MonthInfo[] = [];

  // Если период начинается не с января, добавляем месяцы предыдущего года
  if (startMonth > 0 && startYear > 2000) {
    const prevYear = startYear - 1;
    for (let month = 0; month < startMonth; month++) {
      const monthStart = new Date(prevYear, month, 1);
      const monthEnd = endOfMonth(monthStart);
      months.push({
        year: prevYear,
        month,
        startDate: monthStart,
        endDate: monthEnd,
        daysInMonth: monthEnd.getDate(),
      });
    }
  }

  // Добавляем месяцы основного периода
  const mainMonths = splitPeriodIntoMonths(startDate, endDate);
  months.push(...mainMonths);

  // Если период заканчивается не в декабре, добавляем месяцы следующего года
  if (endMonth < 11 && endYear < 2100) {
    const nextYear = endYear + 1;
    for (let month = endMonth + 1; month < 12; month++) {
      const monthStart = new Date(nextYear, month, 1);
      const monthEnd = endOfMonth(monthStart);
      months.push({
        year: nextYear,
        month,
        startDate: monthStart,
        endDate: monthEnd,
        daysInMonth: monthEnd.getDate(),
      });
    }
  }

  return months;
}

/**
 * Вычислить количество дней в отпуске для сотрудника за год
 */
export function calculateVacationDaysForYear(
  vacations: Array<{ startDate: Date | string; endDate: Date | string }>,
  year: number
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  let totalDays = 0;

  for (const vacation of vacations) {
    const start = new Date(vacation.startDate);
    const end = new Date(vacation.endDate);

    // Пропускаем отпуска, которые не пересекаются с годом
    if (end < yearStart || start > yearEnd) {
      continue;
    }

    // Вычисляем пересечение периода отпуска с годом
    const periodStart = start > yearStart ? start : yearStart;
    const periodEnd = end < yearEnd ? end : yearEnd;

    // Количество дней включительно
    const days = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    totalDays += days;
  }

  return totalDays;
}

/**
 * Проверить, пересекаются ли два периода
 */
export function periodsOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && start2 <= end1;
}

/**
 * Форматировать период для отображения
 */
export function formatPeriod(startDate: Date, endDate: Date, locale: string = 'ru-RU'): string {
  return `${format(startDate, 'dd.MM.yyyy', { locale: require('date-fns/locale/ru') })} - ${format(endDate, 'dd.MM.yyyy', { locale: require('date-fns/locale/ru') })}`;
}

/**
 * Получить все даты в периоде
 */
export function getDatesInPeriod(startDate: Date, endDate: Date): Date[] {
  return eachDayOfInterval({ start: startDate, end: endDate });
}

/**
 * Проверить, находится ли дата в периоде расписания
 */
export function isDateInSchedulePeriod(date: Date, scheduleStart: Date, scheduleEnd: Date): boolean {
  return isWithinInterval(date, { start: scheduleStart, end: scheduleEnd });
}

/**
 * Получить день месяца из даты (1-31)
 */
export function getDayOfMonth(date: Date): number {
  return date.getDate();
}

/**
 * Проверить, является ли дата днем рождения (сравниваем только день и месяц)
 */
export function isBirthday(date: Date, birthDate: Date | string | null | undefined): boolean {
  if (!birthDate) return false;

  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  return date.getMonth() === birth.getMonth() && date.getDate() === birth.getDate();
}

