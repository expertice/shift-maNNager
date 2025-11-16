/**
 * Сервис для работы с производственным календарем РФ
 * Рассчитывает нормы рабочего времени на основе производственного календаря
 */

import prisma from '../lib/prisma.js';
import { getXmlCalendar, convertXmlCalendarToProductionCalendar } from './xmlCalendarService.js';

/**
 * Производственный календарь для года
 */
export interface ProductionCalendar {
  year: number;
  workingDays: number;
  weekendDays: number;
  holidayDays: number;
  holidays: string[]; // ISO date strings
  workingWeekends: string[]; // ISO date strings
}

/**
 * Получить производственный календарь для года
 * Сначала пытается получить из xmlcalendar.ru (проверяет файл, если нет - загружает)
 * Если не удалось - пытается получить из БД, если нет - рассчитывает автоматически
 */
export async function getProductionCalendar(year: number): Promise<ProductionCalendar> {
  try {
    // Пытаемся получить календарь с xmlcalendar.ru
    const xmlCalendar = await getXmlCalendar(year);
    const calendar = convertXmlCalendarToProductionCalendar(xmlCalendar);
    
    // Сохраняем в БД для быстрого доступа в будущем
    const metadata = {
      holidays: calendar.holidays,
      workingWeekends: calendar.workingWeekends,
      preholidayDays: (calendar as any).preholidayDays || [],
    };
    
    await prisma.workHoursNorm.upsert({
      where: { year },
      update: {
        workingDays: calendar.workingDays,
        weekendDays: calendar.weekendDays,
        holidayDays: calendar.holidayDays,
        metadata: metadata as any,
      },
      create: {
        year,
        totalHours: 0, // Будет рассчитано позже
        workingDays: calendar.workingDays,
        weekendDays: calendar.weekendDays,
        holidayDays: calendar.holidayDays,
        metadata: metadata as any,
      },
    });
    
    return calendar;
  } catch (error) {
    console.warn(`Failed to load calendar from xmlcalendar.ru for year ${year}, trying DB...`, error);
    
    // Попытка получить из БД
    const norm = await prisma.workHoursNorm.findUnique({
      where: { year },
    });

    if (norm && norm.metadata) {
      const metadata = norm.metadata as any;
      return {
        year,
        workingDays: norm.workingDays || 0,
        weekendDays: norm.weekendDays || 0,
        holidayDays: norm.holidayDays || 0,
        holidays: metadata.holidays || [],
        workingWeekends: metadata.workingWeekends || [],
      };
    }

    // Если нет в БД - рассчитываем автоматически
    return calculateProductionCalendar(year);
  }
}

/**
 * Рассчитать производственный календарь для года
 * Базовая логика: все будни - рабочие, все выходные - выходные
 * + фиксированные праздники РФ
 */
export function calculateProductionCalendar(year: number): ProductionCalendar {
  const holidays = getFixedHolidaysRF(year);
  const holidaysSet = new Set(holidays);
  
  let workingDays = 0;
  let weekendDays = 0;
  let holidayDays = holidays.length;

  // Проходим по всем дням года
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

      if (holidaysSet.has(dateStr)) {
        // Праздничный день
        continue;
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Выходной день
        weekendDays++;
      } else {
        // Рабочий день
        workingDays++;
      }
    }
  }

  return {
    year,
    workingDays,
    weekendDays,
    holidayDays,
    holidays,
    workingWeekends: [],
  };
}

/**
 * Получить фиксированные праздники РФ для года
 */
function getFixedHolidaysRF(year: number): string[] {
  // Нерабочие праздничные дни в РФ (ст. 112 ТК РФ)
  const holidays: string[] = [
    `${year}-01-01`, // Новый год
    `${year}-01-02`,
    `${year}-01-03`,
    `${year}-01-04`,
    `${year}-01-05`,
    `${year}-01-06`, // Рождество Христово (перенесено)
    `${year}-01-07`, // Рождество Христово
    `${year}-01-08`,
    `${year}-02-23`, // День защитника Отечества
    `${year}-03-08`, // Международный женский день
    `${year}-05-01`, // Праздник Весны и Труда
    `${year}-05-09`, // День Победы
    `${year}-06-12`, // День России
    `${year}-11-04`, // День народного единства
  ];

  return holidays;
}

/**
 * Рассчитать норму рабочих часов для года
 * @param year - год
 * @param weeklyHours - норма часов в неделю (по умолчанию 40)
 */
export async function calculateWorkingHours(
  year: number,
  weeklyHours: number = 40
): Promise<number> {
  const calendar = await getProductionCalendar(year);
  
  // Базовая формула: рабочие дни * (недельная норма / 5)
  // Это приблизительный расчет, т.к. в реальности учитываются предпраздничные дни
  const dailyHours = weeklyHours / 5;
  const totalHours = calendar.workingDays * dailyHours;

  // Вычитаем часы из предпраздничных дней (обычно на 1 час короче)
  // Упрощенный подход: предполагаем ~10-15 предпраздничных дней в году
  const preholidayDays = Math.min(calendar.holidayDays, 15);
  const reducedHours = totalHours - preholidayDays;

  return Math.round(reducedHours * 100) / 100;
}

/**
 * Проверить, является ли день праздничным
 */
export async function isHoliday(date: Date): Promise<boolean> {
  const year = date.getFullYear();
  const calendar = await getProductionCalendar(year);
  const dateStr = date.toISOString().split('T')[0];
  
  return calendar.holidays.includes(dateStr);
}

/**
 * Проверить, является ли выходной рабочим днем
 */
export async function isWorkingWeekend(date: Date): Promise<boolean> {
  const year = date.getFullYear();
  const calendar = await getProductionCalendar(year);
  const dateStr = date.toISOString().split('T')[0];
  
  return calendar.workingWeekends.includes(dateStr);
}

/**
 * Получить количество рабочих дней в году
 */
export async function getWorkingDaysInYear(year: number): Promise<number> {
  const calendar = await getProductionCalendar(year);
  return calendar.workingDays;
}

/**
 * Получить количество рабочих дней в диапазоне дат
 */
export async function getWorkingDaysInRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  let workingDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = await isHoliday(currentDate);
    const workingWeekend = await isWorkingWeekend(currentDate);

    if ((!isWeekend && !holiday) || workingWeekend) {
      workingDays++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * Рассчитать норму рабочих часов для месяца
 * @param year - год
 * @param month - месяц (1-12)
 * @param weeklyHours - норма часов в неделю (по умолчанию 40)
 */
export async function calculateMonthlyHoursNorm(
  year: number,
  month: number,
  weeklyHours: number = 40
): Promise<number> {
  const calendar = await getProductionCalendar(year);
  const preholidayDays = (calendar as any).preholidayDays || [];
  
  // Получаем все дни месяца
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDaysInMonth = 0;
  let preholidayDaysInMonth = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Проверяем, является ли день праздничным
    if (calendar.holidays.includes(dateStr)) {
      continue; // Праздничный день - не рабочий
    }
    
    // Проверяем, является ли день рабочим выходным
    if (calendar.workingWeekends.includes(dateStr)) {
      workingDaysInMonth++;
      continue;
    }
    
    // Проверяем, является ли день предпраздничным
    if (preholidayDays.includes(dateStr)) {
      workingDaysInMonth++;
      preholidayDaysInMonth++;
      continue;
    }
    
    // Проверяем, является ли день выходным
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue; // Выходной день
    }
    
    // Будний день - рабочий
    workingDaysInMonth++;
  }
  
  // Норма часов в день = недельная норма / 5
  const dailyHours = weeklyHours / 5;
  
  // Норма месяца = рабочие дни × норма часов в день - 1 час за каждый предпраздничный день
  const totalHours = workingDaysInMonth * dailyHours - preholidayDaysInMonth;
  
  return Math.round(totalHours * 100) / 100;
}

