/**
 * Модуль для расчета метрик сравнения профилей смен
 * Расширяемая архитектура позволяет легко добавлять новые метрики
 */

import { ShiftType } from '@prisma/client';
import { ProfileComparisonMetric } from '../types';
import { BulkShiftData } from './shiftsService';

/**
 * Интерфейс калькулятора метрик
 * Любая новая метрика должна реализовывать этот интерфейс
 */
export interface MetricCalculator {
  calculate(shifts: BulkShiftData[], shiftTypes: ShiftType[]): ProfileComparisonMetric;
}

/**
 * Реестр метрик для расширяемости
 */
export const metricsRegistry: Map<string, MetricCalculator> = new Map();

/**
 * Рассчитать количество смен для сотрудника
 */
export function calculateShiftsCount(shifts: BulkShiftData[]): number {
  return shifts.length;
}

/**
 * Рассчитать общее количество рабочих часов
 */
export function calculateTotalHours(shifts: BulkShiftData[], shiftTypes: ShiftType[]): number {
  let totalHours = 0;

  // Создаем мапу для быстрого доступа к типам смен по ID
  const shiftTypeMap = new Map<string, ShiftType>();
  shiftTypes.forEach((type) => {
    shiftTypeMap.set(type.id, type);
  });

  // Суммируем часы для каждой смены
  shifts.forEach((shift) => {
    if (shift.shiftTypeId) {
      const shiftType = shiftTypeMap.get(shift.shiftTypeId);
      if (shiftType) {
        totalHours += Number(shiftType.workingHours);
      }
    }
  });

  return totalHours;
}

/**
 * Рассчитать количество ночных часов
 */
export function calculateNightHours(shifts: BulkShiftData[], shiftTypes: ShiftType[]): number {
  let nightHours = 0;

  // Создаем мапу для быстрого доступа к типам смен по ID
  const shiftTypeMap = new Map<string, ShiftType>();
  shiftTypes.forEach((type) => {
    shiftTypeMap.set(type.id, type);
  });

  // Суммируем ночные часы для каждой смены
  shifts.forEach((shift) => {
    if (shift.shiftTypeId) {
      const shiftType = shiftTypeMap.get(shift.shiftTypeId);
      if (shiftType) {
        nightHours += shiftType.nightHoursCount;
      }
    }
  });

  return nightHours;
}

/**
 * Калькулятор количества рабочих дней в выходные
 * Пример расширяемости - можно добавить в будущем
 */
export class WeekendWorkDaysCalculator implements MetricCalculator {
  calculate(shifts: BulkShiftData[], shiftTypes: ShiftType[]): ProfileComparisonMetric {
    let weekendDays = 0;

    shifts.forEach((shift) => {
      const date = new Date(shift.date);
      const dayOfWeek = date.getDay(); // 0 = воскресенье, 6 = суббота

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDays++;
      }
    });

    return {
      metricId: 'weekend_work_days',
      metricName: 'Рабочие дни в выходные',
      value: weekendDays,
    };
  }
}

/**
 * Калькулятор максимальной непрерывной работы
 * Пример расширяемости - можно добавить в будущем
 */
export class LongestWorkPeriodCalculator implements MetricCalculator {
  calculate(shifts: BulkShiftData[], shiftTypes: ShiftType[]): ProfileComparisonMetric {
    if (shifts.length === 0) {
      return {
        metricId: 'longest_consecutive_work',
        metricName: 'Максимальная непрерывная работа (дней)',
        value: 0,
      };
    }

    // Сортируем смены по дате
    const sortedShifts = [...shifts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedShifts.length; i++) {
      const prevDate = new Date(sortedShifts[i - 1].date);
      const currentDate = new Date(sortedShifts[i].date);

      // Разница в днях
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Последовательные дни
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        // Разрыв в последовательности
        currentStreak = 1;
      }
    }

    return {
      metricId: 'longest_consecutive_work',
      metricName: 'Максимальная непрерывная работа (дней)',
      value: maxStreak,
    };
  }
}

/**
 * Калькулятор количества выходных дней
 * Пример расширяемости - можно добавить в будущем
 */
export class DaysOffCalculator implements MetricCalculator {
  calculate(shifts: BulkShiftData[], shiftTypes: ShiftType[]): ProfileComparisonMetric {
    // Этот метод требует знания общего периода
    // Для простоты возвращаем placeholder
    return {
      metricId: 'days_off',
      metricName: 'Количество выходных',
      value: 'N/A',
    };
  }
}

/**
 * Калькулятор средней продолжительности смены
 * Пример расширяемости - можно добавить в будущем
 */
export class AverageShiftDurationCalculator implements MetricCalculator {
  calculate(shifts: BulkShiftData[], shiftTypes: ShiftType[]): ProfileComparisonMetric {
    if (shifts.length === 0) {
      return {
        metricId: 'average_shift_duration',
        metricName: 'Средняя продолжительность смены (часов)',
        value: 0,
      };
    }

    const totalHours = calculateTotalHours(shifts, shiftTypes);
    const averageHours = totalHours / shifts.length;

    return {
      metricId: 'average_shift_duration',
      metricName: 'Средняя продолжительность смены (часов)',
      value: Math.round(averageHours * 100) / 100, // Округляем до 2 знаков
    };
  }
}

// Регистрируем доступные калькуляторы (закомментированы, так как пока не используются)
// metricsRegistry.set('weekend_work_days', new WeekendWorkDaysCalculator());
// metricsRegistry.set('longest_consecutive_work', new LongestWorkPeriodCalculator());
// metricsRegistry.set('days_off', new DaysOffCalculator());
// metricsRegistry.set('average_shift_duration', new AverageShiftDurationCalculator());

/**
 * Рассчитать все дополнительные метрики из реестра
 */
export function calculateAdditionalMetrics(
  shifts: BulkShiftData[],
  shiftTypes: ShiftType[]
): ProfileComparisonMetric[] {
  const metrics: ProfileComparisonMetric[] = [];

  metricsRegistry.forEach((calculator) => {
    try {
      const metric = calculator.calculate(shifts, shiftTypes);
      metrics.push(metric);
    } catch (error) {
      console.error('Error calculating metric:', error);
    }
  });

  return metrics;
}

