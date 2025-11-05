import { ShiftBreak } from '@types';

/**
 * Преобразование времени HH:mm в минуты от начала суток
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Преобразование минут от начала суток в время HH:mm
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Расчет общей длительности смены в минутах (без учета перерывов)
 */
export function calculateShiftDuration(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (end >= start) {
    // Смена в пределах одного дня
    return end - start;
  } else {
    // Смена переходит через полночь
    return 24 * 60 - start + end;
  }
}

/**
 * Расчет автоматических перерывов для смены
 * 
 * Правила:
 * - Если смена < 12 часов: автоматически добавляется часовой перерыв посередине смены
 * - Если смена >= 12 часов: перерывы задаются вручную
 * 
 * @param startTime - Время начала смены (HH:mm)
 * @param endTime - Время окончания смены (HH:mm)
 * @param manualBreaks - Перерывы, заданные вручную
 * @returns Массив перерывов (автоматические + ручные)
 */
export function calculateShiftBreaks(
  startTime: string,
  endTime: string,
  manualBreaks: ShiftBreak[] = []
): ShiftBreak[] {
  const durationMinutes = calculateShiftDuration(startTime, endTime);
  const durationHours = durationMinutes / 60;

  // Если смена меньше 12 часов, добавляем автоматический перерыв посередине
  if (durationHours < 12 && durationHours > 0) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    
    // Вычисляем середину смены
    const middlePoint = start + durationMinutes / 2;
    
    // Перерыв длится 1 час и начинается за 30 минут до середины
    // То есть перерыв: от (середина - 30 мин) до (середина + 30 мин)
    const breakStartMinutes = middlePoint - 30;
    const breakEndMinutes = middlePoint + 30;

    // Нормализуем время в диапазон 0-1440 минут (24 часа)
    const normalizedBreakStart = ((breakStartMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const normalizedBreakEnd = ((breakEndMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);

    const automaticBreak: ShiftBreak = {
      startTime: minutesToTime(normalizedBreakStart),
      endTime: minutesToTime(normalizedBreakEnd),
      duration: 60, // 1 час = 60 минут
    };

    // Возвращаем автоматический перерыв + ручные перерывы
    return [automaticBreak, ...manualBreaks];
  }

  // Для смен >= 12 часов возвращаем только ручные перерывы
  return manualBreaks;
}

/**
 * Расчет ночных часов в смене
 * Ночные часы: с 22:00 до 06:00
 */
export function calculateNightHours(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  let nightMinutes = 0;

  // Если смена начинается и заканчивается в один день
  if (end > start) {
    for (let minute = start; minute < end; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (hour >= 22 || hour < 6) {
        nightMinutes++;
      }
    }
  } else {
    // Смена переходит через полночь (например, 21:00-09:00)
    // Ночные часы до полуночи
    for (let minute = start; minute < 24 * 60; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (hour >= 22 || hour < 6) {
        nightMinutes++;
      }
    }
    // Ночные часы после полуночи
    for (let minute = 0; minute < end; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (hour >= 22 || hour < 6) {
        nightMinutes++;
      }
    }
  }

  return Math.round((nightMinutes / 60) * 100) / 100; // Возвращаем количество часов с округлением до 2 знаков
}

/**
 * Расчет рабочих часов смены (общая длительность минус перерывы)
 */
export function calculateWorkingHours(
  startTime: string,
  endTime: string,
  breaks: ShiftBreak[]
): number {
  const durationMinutes = calculateShiftDuration(startTime, endTime);

  // Суммируем длительность всех перерывов
  let breakMinutes = 0;
  breaks.forEach((b) => {
    breakMinutes += b.duration;
  });

  // Рабочие часы = общая длительность - перерывы
  const workingMinutes = durationMinutes - breakMinutes;
  return Math.round((workingMinutes / 60) * 100) / 100; // Округляем до 2 знаков после запятой
}

/**
 * Расчет всех параметров смены
 */
export interface ShiftCalculationsResult {
  duration: number; // Общая длительность в часах
  nightHours: number; // Количество ночных часов
  workingHours: number; // Рабочие часы (с учетом перерывов)
  breaks: ShiftBreak[]; // Финальные перерывы (автоматические + ручные)
}

export function calculateShiftParameters(
  startTime: string,
  endTime: string,
  manualBreaks: ShiftBreak[] = []
): ShiftCalculationsResult {
  const breaks = calculateShiftBreaks(startTime, endTime, manualBreaks);
  const duration = calculateShiftDuration(startTime, endTime) / 60;
  const nightHours = calculateNightHours(startTime, endTime);
  const workingHours = calculateWorkingHours(startTime, endTime, breaks);

  return {
    duration,
    nightHours,
    workingHours,
    breaks,
  };
}

