import { ShiftPattern, ShiftType } from '@types';

/**
 * Интерфейсы для валидации
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Вычисление длины цикла (максимальная длина цикла среди всех паттернов)
 */
export function calculateCycleLength(patterns: ShiftPattern[]): number {
  if (!patterns || patterns.length === 0) {
    return 0;
  }
  return Math.max(...patterns.map((p) => p.cycleLength));
}

/**
 * Вычисление минимального количества сотрудников
 * Минимальное количество сотрудников = количество паттернов
 * (каждый паттерн должен быть назначен минимум одному сотруднику)
 */
export function calculateMinEmployees(patterns: ShiftPattern[]): number {
  if (!patterns || patterns.length === 0) {
    return 0;
  }
  return patterns.length;
}

/**
 * Преобразование времени HH:mm в минуты от начала суток
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Преобразование минут от начала суток в время HH:mm
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Проверка, попадает ли время в ночной период (22:00-06:00)
 */
function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

/**
 * Подсчет ночных часов в смене
 */
function calculateNightHours(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  let nightHours = 0;

  // Если смена начинается и заканчивается в один день
  if (end > start) {
    for (let minute = start; minute < end; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (isNightHour(hour)) {
        nightHours++;
      }
    }
  } else {
    // Смена переходит через полночь (например, 21:00-09:00)
    // Ночные часы до полуночи
    for (let minute = start; minute < 24 * 60; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (isNightHour(hour)) {
        nightHours++;
      }
    }
    // Ночные часы после полуночи
    for (let minute = 0; minute < end; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (isNightHour(hour)) {
        nightHours++;
      }
    }
  }

  return Math.floor(nightHours / 60); // Возвращаем количество часов
}

/**
 * Создание массива покрытия часа дня (0-23) сменой
 * Возвращает массив из 24 элементов, где true означает покрытие часа
 */
function getShiftCoverage(
  startTime: string,
  endTime: string,
  breaks: Array<{ startTime: string; endTime: string; duration: number }>
): boolean[] {
  const coverage = new Array(24).fill(false);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  // Если смена начинается и заканчивается в один день
  if (end > start) {
    for (let minute = start; minute < end; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      coverage[hour] = true;
    }
  } else {
    // Смена переходит через полночь
    for (let minute = start; minute < 24 * 60; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      coverage[hour] = true;
    }
    for (let minute = 0; minute < end; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      coverage[hour] = true;
    }
  }

  // Вычитаем перерывы
  for (const breakTime of breaks) {
    const breakStart = timeToMinutes(breakTime.startTime);
    const breakEnd = timeToMinutes(breakTime.endTime);

    if (breakEnd > breakStart) {
      for (let minute = breakStart; minute < breakEnd; minute++) {
        const hour = Math.floor(minute / 60) % 24;
        coverage[hour] = false;
      }
    } else {
      // Перерыв переходит через полночь
      for (let minute = breakStart; minute < 24 * 60; minute++) {
        const hour = Math.floor(minute / 60) % 24;
        coverage[hour] = false;
      }
      for (let minute = 0; minute < breakEnd; minute++) {
        const hour = Math.floor(minute / 60) % 24;
        coverage[hour] = false;
      }
    }
  }

  return coverage;
}

/**
 * Валидация покрытия 24 часов в сутки
 * Проверяет, что все 24 часа каждого дня цикла покрыты хотя бы одной сменой
 */
export function validate24HourCoverage(
  patterns: ShiftPattern[],
  shiftTypes: ShiftType[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!patterns || patterns.length === 0) {
    errors.push('Не указаны паттерны');
    return { isValid: false, errors, warnings };
  }

  if (!shiftTypes || shiftTypes.length === 0) {
    errors.push('Не указаны типы смен');
    return { isValid: false, errors, warnings };
  }

  // Создаем словарь типов смен для быстрого доступа
  const shiftTypeMap = new Map(shiftTypes.map((st) => [st.id, st]));

  // Для каждого паттерна проверяем покрытие всех дней цикла
  patterns.forEach((pattern) => {
    const maxCycleLength = Math.max(
      ...patterns.map((p) => p.cycleLength),
      pattern.cycleLength
    );

    // Проверяем каждый день цикла
    for (let day = 0; day < pattern.cycleLength; day++) {
      const hourlyCoverage = new Array(24).fill(false);

      // Собираем все смены для этого дня из всех паттернов
      patterns.forEach((p) => {
        if (day < p.sequence.length) {
          const shiftTypeId = p.sequence[day];
          if (shiftTypeId) {
            const shiftType = shiftTypeMap.get(shiftTypeId);
            if (shiftType) {
              const coverage = getShiftCoverage(
                shiftType.startTime,
                shiftType.endTime,
                shiftType.breaks
              );
              coverage.forEach((covered, hour) => {
                if (covered) {
                  hourlyCoverage[hour] = true;
                }
              });
            }
          }
        }
      });

      // Проверяем, все ли 24 часа покрыты
      const uncoveredHours: number[] = [];
      for (let hour = 0; hour < 24; hour++) {
        if (!hourlyCoverage[hour]) {
          uncoveredHours.push(hour);
        }
      }

      if (uncoveredHours.length > 0) {
        errors.push(
          `День ${day + 1} паттерна ${pattern.patternNumber}: непокрытые часы: ${uncoveredHours
            .map((h) => `${h}:00`)
            .join(', ')}`
        );
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Валидация количества сотрудников на смене
 * Для каждого дня цикла проверяет количество активных смен
 */
export function validateEmployeesPerShift(
  patterns: ShiftPattern[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!patterns || patterns.length === 0) {
    errors.push('Не указаны паттерны');
    return { isValid: false, errors, warnings };
  }

  const maxCycleLength = Math.max(...patterns.map((p) => p.cycleLength));

  // Для каждого дня цикла считаем количество активных смен
  for (let day = 0; day < maxCycleLength; day++) {
    let activeShiftsCount = 0;

    patterns.forEach((pattern) => {
      if (day < pattern.sequence.length) {
        const shiftTypeId = pattern.sequence[day];
        if (shiftTypeId !== null) {
          activeShiftsCount++;
        }
      }
    });

    // Можно добавить проверки на минимальное/максимальное количество сотрудников
    // Пока просто предупреждение, если в какой-то день нет ни одной смены
    if (activeShiftsCount === 0) {
      warnings.push(`День ${day + 1}: нет активных смен`);
    }
  }

  return {
    isValid: true,
    errors,
    warnings,
  };
}

/**
 * Общая валидация профиля смены
 */
export function validateShiftProfile(
  patterns: ShiftPattern[],
  shiftTypes: ShiftType[]
): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Валидация покрытия 24 часов
  const coverageValidation = validate24HourCoverage(patterns, shiftTypes);
  allErrors.push(...coverageValidation.errors);
  allWarnings.push(...coverageValidation.warnings);

  // Валидация количества сотрудников
  const employeesValidation = validateEmployeesPerShift(patterns);
  allErrors.push(...employeesValidation.errors);
  allWarnings.push(...employeesValidation.warnings);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Получить количество сотрудников на смене для каждого дня
 */
export function getEmployeesPerDay(patterns: ShiftPattern[]): number[] {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  const maxCycleLength = Math.max(...patterns.map((p) => p.cycleLength));
  const employeesPerDay: number[] = [];

  for (let day = 0; day < maxCycleLength; day++) {
    let count = 0;
    patterns.forEach((pattern) => {
      if (day < pattern.sequence.length) {
        const shiftTypeId = pattern.sequence[day];
        if (shiftTypeId !== null) {
          count++;
        }
      }
    });
    employeesPerDay.push(count);
  }

  return employeesPerDay;
}

/**
 * Подсчитать непокрытые часы по дням с игнорированием перерывов
 * Возвращает массив длиной maxCycleLength, где элемент — массив часов (0-23), не покрытых ни одной сменой
 */
export function getUncoveredHoursByDayIgnoringBreaks(
  patterns: ShiftPattern[],
  shiftTypes: ShiftType[]
): number[][] {
  if (!patterns || patterns.length === 0 || !shiftTypes || shiftTypes.length === 0) {
    return [];
  }

  const maxCycleLength = Math.max(...patterns.map((p) => p.cycleLength));
  const shiftTypeMap = new Map(shiftTypes.map((st) => [st.id, st]));

  const result: number[][] = [];

  for (let day = 0; day < maxCycleLength; day++) {
    const hourlyCoverage = new Array(24).fill(false);

    // Для каждого паттерна берем тип смены на этот день и отмечаем покрытие, перерывы игнорируем
    patterns.forEach((pattern) => {
      if (day < pattern.sequence.length) {
        const shiftTypeId = pattern.sequence[day];
        if (shiftTypeId) {
          const st = shiftTypeMap.get(shiftTypeId);
          if (st) {
            const start = timeToMinutes(st.startTime);
            const end = timeToMinutes(st.endTime);

            if (end > start) {
              for (let minute = start; minute < end; minute++) {
                const hour = Math.floor(minute / 60) % 24;
                hourlyCoverage[hour] = true;
              }
            } else {
              // Через полночь
              for (let minute = start; minute < 24 * 60; minute++) {
                const hour = Math.floor(minute / 60) % 24;
                hourlyCoverage[hour] = true;
              }
              for (let minute = 0; minute < end; minute++) {
                const hour = Math.floor(minute / 60) % 24;
                hourlyCoverage[hour] = true;
              }
            }
          }
        }
      }
    });

    const uncovered: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      if (!hourlyCoverage[hour]) uncovered.push(hour);
    }
    result.push(uncovered);
  }

  return result;
}

