import { prisma } from '../lib/prisma';
import { ShiftProfile, ShiftType, ShiftProfilePattern, RosterPatternInstance } from '@prisma/client';
import { computePositionInCycle, getSequenceFromPatternOrInstance, nextDayUtcStart, normalizeUtcStart } from '../utils/patternCycle';
import { bulkCreateShifts, BulkShiftData, deleteShiftsByPeriod } from './shiftsService';
import { startOfDay, eachDayOfInterval } from 'date-fns';
import {
  calculateShiftsCount,
  calculateTotalHours,
  calculateNightHours,
  calculateAdditionalMetrics,
} from './profileComparisonService';
import {
  CompareProfilesResponse,
  ProfileComparisonResult,
  EmployeeProfileMetrics,
  VisualizedPattern,
  ShiftTypeForVisualization,
  ShiftProfileForComparison,
} from '../types';

export interface ShiftProfileWithDetails extends ShiftProfile {
  shiftTypes: ShiftType[];
  patterns: ShiftProfilePattern[];
}

export interface GenerateShiftsParams {
  scheduleId: string;
  shiftProfileId: string;
  employeeIds: string[];
  startDate: Date;
  endDate: Date;
}

export interface UpdateShiftTypeData {
  id?: string; // Если указан, обновляем существующий
  name: string;
  startTime: string;
  endTime: string;
  breaks: Array<{ startTime: string; endTime: string; duration: number }>;
  nightHoursCount: number;
  workingHours: number;
  color?: string;
}

export interface UpdateShiftPatternData {
  id?: string; // Если указан, обновляем существующий
  patternNumber: number;
  cycleLength: number;
  sequence: (string | null)[]; // ID типов смен или null для отдыха
}

export interface UpdateShiftProfileData {
  name: string;
  description?: string | null;
  shiftTypes: UpdateShiftTypeData[];
  patterns: UpdateShiftPatternData[];
  // cycleLength и minEmployees вычисляются автоматически
}

/**
 * Получить все профили смен
 */
export async function getAllShiftProfiles(): Promise<ShiftProfileWithDetails[]> {
  return prisma.shiftProfile.findMany({
    include: {
      shiftTypes: {
        orderBy: {
          startTime: 'asc',
        },
      },
      patterns: {
        orderBy: {
          patternNumber: 'asc',
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
}

/**
 * Получить профиль смены по ID
 */
export async function getShiftProfileById(id: string): Promise<ShiftProfileWithDetails | null> {
  return prisma.shiftProfile.findUnique({
    where: { id },
    include: {
      shiftTypes: {
        orderBy: {
          startTime: 'asc',
        },
      },
      patterns: {
        orderBy: {
          patternNumber: 'asc',
        },
      },
    },
  });
}

/**
 * Генерация смен на основе профиля смены
 * Применяет паттерны к сотрудникам и создает смены на весь период
 */
export async function generateShiftsFromProfile(
  params: GenerateShiftsParams
): Promise<{ count: number; shifts: BulkShiftData[] }> {
  const { scheduleId, shiftProfileId, employeeIds, startDate, endDate } = params;

  // Получаем профиль с деталями
  const profile = await getShiftProfileById(shiftProfileId);

  if (!profile) {
    throw new Error('Shift profile not found');
  }

  // Проверяем минимальное количество сотрудников
  if (employeeIds.length < profile.minEmployees) {
    throw new Error(
      `Insufficient employees. Minimum required: ${profile.minEmployees}, provided: ${employeeIds.length}`
    );
  }

  // Проверяем наличие паттернов
  if (!profile.patterns || profile.patterns.length === 0) {
    throw new Error('Shift profile has no patterns');
  }

  // Генерируем для всех переданных сотрудников (minEmployees — это минимум, не потолок)
  const employeesToProcess = employeeIds;

  // Очищаем существующие смены в указанном периоде ТОЛЬКО для этих сотрудников
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (employeesToProcess.length > 0) {
    const normalizedStart = normalizeUtcStart(start);
    const normalizedEndExclusive = nextDayUtcStart(end);
    // Диагностика: логируем параметры удаления
    console.info('[generateShifts] delete range', {
      scheduleId,
      employees: employeesToProcess.length,
      startISO: normalizedStart.toISOString(),
      endExclusiveISO: normalizedEndExclusive.toISOString(),
    });
    await prisma.dailyShift.deleteMany({
      where: {
        scheduleId,
        employeeId: { in: employeesToProcess },
        date: {
          gte: normalizedStart,
          lt: normalizedEndExclusive,
        },
      },
    });
  }

  const shifts: BulkShiftData[] = [];
  // start и end уже определены выше при очистке смен

  // Определяем базовую дату начала цикла для данного назначения профиля на схему,
  // чтобы продолжать паттерны между месяцами, а не перезапускать их каждый месяц
  let baseCycleStart = start;
  
  // Получаем существующие назначения для этого профиля
  const assignments = await prisma.scheduleShiftAssignment.findMany({
    where: { scheduleId, shiftProfileId },
    orderBy: { startDate: 'asc' },
  });
  
  // Если есть существующие назначения, используем самую раннюю базовую дату
  if (assignments.length > 0) {
    const knownStarts = assignments
      .map((a) => a.startDate)
      .filter((d): d is Date => !!d);
    if (knownStarts.length > 0) {
      // Берем самую раннюю базовую дату, чтобы не было «сброса» при новых назначениях
      const earliest = new Date(Math.min(...knownStarts.map((d) => d.getTime())));
      baseCycleStart = startOfDay(earliest);
    }
  }
  
  // ВСЕГДА создаем новое назначение при генерации - это отмечает факт использования профиля
  const allAssignments = await prisma.scheduleShiftAssignment.findMany({
    where: { scheduleId },
    orderBy: { assignmentNumber: 'desc' },
    take: 1,
  });
  const nextAssignmentNumber = (allAssignments[0]?.assignmentNumber || 0) + 1;
  
  await prisma.scheduleShiftAssignment.create({
    data: {
      scheduleId,
      shiftProfileId,
      assignmentNumber: nextAssignmentNumber,
      startDate: baseCycleStart,
    },
  });

  // Готовим/гарантируем наличие экземпляров паттернов для сотрудников.
  // ВАЖНО: не переопределяем существующие назначения, чтобы порядок сотрудников между месяцами
  // не влиял на продолжение паттерна.
  const existingInstances = await prisma.rosterPatternInstance.findMany({
    where: { scheduleId, employeeId: { in: employeesToProcess } },
    include: { pattern: true },
  });
  const employeeIdToInstance: Map<string, RosterPatternInstance & { pattern: ShiftProfilePattern | null }> = new Map(
    existingInstances.map((ri) => [ri.employeeId, ri])
  );

  const employeesWithoutInstance = employeesToProcess.filter((id) => !employeeIdToInstance.has(id));
  if (employeesWithoutInstance.length > 0) {
    // При первом назначении распределяем паттерны циклически по переданному порядку,
    // фиксируя смещение startIndex только один раз.
    const toCreate: Parameters<typeof prisma.rosterPatternInstance.create>[0][] = [];
    for (let i = 0; i < employeesToProcess.length; i++) {
      const employeeId = employeesToProcess[i];
      if (employeeIdToInstance.has(employeeId)) continue;
      const patternIndex = i % profile.patterns.length;
      const pattern = profile.patterns[patternIndex];
      const sequence = pattern.sequence as (string | null)[];
      toCreate.push({
        data: {
          scheduleId,
          employeeId,
          patternId: pattern.id,
          // Смещение по циклу закрепляем в startIndex, чтобы следующий месяц продолжался корректно
          startIndex: 0,
          sequence,
        },
      });
    }
    if (toCreate.length > 0) {
      const created = await prisma.$transaction(toCreate.map((c) => prisma.rosterPatternInstance.create(c)));
      // Обновляем карту
      const createdWithPattern = await prisma.rosterPatternInstance.findMany({
        where: { id: { in: created.map((c) => c.id) } },
        include: { pattern: true },
      });
      for (const ri of createdWithPattern) {
        employeeIdToInstance.set(ri.employeeId, ri);
      }
    }
  }

  // Обновляем существующие экземпляры, если профиль/паттерн изменился,
  // чтобы UI (ростер) показывал актуальную последовательность
  const updates: Parameters<typeof prisma.rosterPatternInstance.update>[0][] = [];
  for (let i = 0; i < employeesToProcess.length; i++) {
    const employeeId = employeesToProcess[i];
    const currentInstance = employeeIdToInstance.get(employeeId);
    const patternIndex = i % profile.patterns.length;
    const pattern = profile.patterns[patternIndex];
    const newSequence = pattern.sequence as (string | null)[];
    if (currentInstance) {
      const needsPatternChange = currentInstance.patternId !== pattern.id;
      const needsSequenceChange = JSON.stringify(currentInstance.sequence) !== JSON.stringify(newSequence);
      if (needsPatternChange || needsSequenceChange) {
        updates.push({
          where: { id: currentInstance.id },
          data: {
            patternId: pattern.id,
            // сохраняем прежний startIndex, чтобы смещение цикла не сбивалось
            sequence: newSequence,
          },
        });
      }
    }
  }
  if (updates.length > 0) {
    await prisma.$transaction(updates.map((u) => prisma.rosterPatternInstance.update(u)));
  }

  // Получаем все дни в периоде включительно (от startDate до endDate)
  const periodDays = eachDayOfInterval({ start, end });

  // Проходим по всем датам в периоде
  periodDays.forEach((currentDate) => {
    // Для каждого сотрудника определяем, какая смена ему назначена
    employeesToProcess.forEach((employeeId, index) => {
      // Берем закрепленный для сотрудника экземпляр паттерна
      const instance = employeeIdToInstance.get(employeeId);
      // Если по какой-то причине экземпляра нет — дефолтимся на первый паттерн
      const pattern = instance?.pattern ?? profile.patterns[0];

      const positionInCycle = computePositionInCycle(currentDate, baseCycleStart, pattern.cycleLength, instance?.startIndex ?? 0);

      // Получаем тип смены для этой позиции в паттерне (предпочитаем sequence из экземпляра)
      const sequence = getSequenceFromPatternOrInstance(instance?.sequence as (string | null)[] | undefined, pattern);
      const shiftTypeId = sequence[positionInCycle];

      // Если shiftTypeId не null, создаем смену
      if (shiftTypeId) {
        // Нормализуем дату к началу дня в UTC
        // Используем локальные компоненты даты для получения правильной календарной даты,
        // но создаем дату в UTC, чтобы избежать проблем с часовыми поясами при сохранении
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();
        // Создаем дату в UTC на начало дня - это гарантирует правильную дату в БД
        const normalizedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        shifts.push({
          employeeId,
          date: normalizedDate,
          shiftTypeId,
        });
      }
      // Если null - это день отдыха, смена не создается
    });
  });
  
  // Диагностика: первые 5 записей для проверки
  console.info('[generateShifts] to upsert', {
    scheduleId,
    total: shifts.length,
    sample: shifts.slice(0, 5).map((s) => ({ employeeId: s.employeeId, date: s.date.toISOString(), shiftTypeId: s.shiftTypeId })),
  });

  const count = await bulkCreateShifts(scheduleId, shifts);

  return {
    count,
    shifts,
  };
}

/**
 * Вычисление длины цикла (максимальная длина цикла среди всех паттернов)
 */
export function calculateCycleLength(patterns: UpdateShiftPatternData[]): number {
  if (!patterns || patterns.length === 0) {
    return 0;
  }
  return Math.max(...patterns.map((p) => p.cycleLength));
}

/**
 * Вычисление минимального количества сотрудников
 * (максимальное количество одновременно работающих в любой момент времени)
 */
export function calculateMinEmployees(patterns: UpdateShiftPatternData[]): number {
  if (!patterns || patterns.length === 0) {
    return 0;
  }

  // Для каждого паттерна находим максимальное количество не-null смен в цикле
  const maxShiftsPerPattern = patterns.map((pattern) => {
    const activeShifts = pattern.sequence.filter((shiftTypeId) => shiftTypeId !== null).length;
    return activeShifts;
  });

  // Минимальное количество сотрудников = количество паттернов
  // (каждый паттерн должен быть назначен минимум одному сотруднику)
  return patterns.length;
}

/**
 * Создание нового профиля смены
 */
export async function createShiftProfile(
  data: UpdateShiftProfileData
): Promise<ShiftProfileWithDetails> {
  // Вычисляем автоматически cycleLength и minEmployees
  const cycleLength = calculateCycleLength(data.patterns);
  const minEmployees = calculateMinEmployees(data.patterns);

  // Начинаем транзакцию для атомарного создания
  return prisma.$transaction(async (tx) => {
    // Создаем профиль
    const newProfile = await tx.shiftProfile.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        cycleLength,
        minEmployees,
      },
    });

    // Проверка уникальности имен типов смен
    const shiftTypeNames = data.shiftTypes.map((st) => st.name.toLowerCase().trim());
    const uniqueNames = new Set(shiftTypeNames);
    if (shiftTypeNames.length !== uniqueNames.size) {
      throw new Error('Имена типов смен должны быть уникальными в рамках профиля');
    }

    // Создаем типы смен и сохраняем маппинг временных ID на реальные
    const tempIdToRealId = new Map<string, string>();
    for (const shiftTypeData of data.shiftTypes) {
      const createdType = await tx.shiftType.create({
        data: {
          shiftProfileId: newProfile.id,
          name: shiftTypeData.name,
          startTime: shiftTypeData.startTime,
          endTime: shiftTypeData.endTime,
          breaks: shiftTypeData.breaks,
          nightHoursCount: shiftTypeData.nightHoursCount,
          workingHours: shiftTypeData.workingHours,
          color: (shiftTypeData as any).color || null,
        },
      });
      
      // Если был временный ID, сохраняем маппинг
      if (shiftTypeData.id && shiftTypeData.id.startsWith('temp-')) {
        tempIdToRealId.set(shiftTypeData.id, createdType.id);
      }
    }

    // Создаем паттерны, заменяя временные ID на реальные
    for (const patternData of data.patterns) {
      const sequence = patternData.sequence.map((shiftTypeId) => {
        if (shiftTypeId && tempIdToRealId.has(shiftTypeId)) {
          return tempIdToRealId.get(shiftTypeId)!;
        }
        return shiftTypeId;
      });

      await tx.shiftProfilePattern.create({
        data: {
          shiftProfileId: newProfile.id,
          patternNumber: patternData.patternNumber,
          cycleLength: patternData.cycleLength,
          sequence,
        },
      });
    }

    // Возвращаем созданный профиль с деталями внутри транзакции
    return tx.shiftProfile.findUnique({
      where: { id: newProfile.id },
      include: {
        shiftTypes: {
          orderBy: {
            startTime: 'asc',
          },
        },
        patterns: {
          orderBy: {
            patternNumber: 'asc',
          },
        },
      },
    });
  }).then((result) => {
    if (!result) {
      throw new Error('Failed to retrieve created profile');
    }
    return result;
  });
}

/**
 * Обновление профиля смены
 */
export async function updateShiftProfile(
  id: string,
  data: UpdateShiftProfileData
): Promise<ShiftProfileWithDetails> {
  // Вычисляем автоматически cycleLength и minEmployees
  const cycleLength = calculateCycleLength(data.patterns);
  const minEmployees = calculateMinEmployees(data.patterns);

  // Начинаем транзакцию для атомарного обновления
  return prisma.$transaction(async (tx) => {
    // Обновляем основные поля профиля
    const updatedProfile = await tx.shiftProfile.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        cycleLength,
        minEmployees,
      },
    });

    // Получаем существующие типы смен и паттерны
    const existingShiftTypes = await tx.shiftType.findMany({
      where: { shiftProfileId: id },
    });

    const existingPatterns = await tx.shiftProfilePattern.findMany({
      where: { shiftProfileId: id },
    });

    // Определяем, какие типы смен нужно создать, обновить или удалить
    const incomingTypeIds = new Set(
      data.shiftTypes.map((t) => t.id).filter((id): id is string => !!id)
    );
    const existingTypeIds = new Set(existingShiftTypes.map((t) => t.id));

    // Удаляем типы смен, которых нет в новых данных
    const typesToDelete = existingShiftTypes.filter((t) => !incomingTypeIds.has(t.id));
    if (typesToDelete.length > 0) {
      await tx.shiftType.deleteMany({
        where: {
          id: { in: typesToDelete.map((t) => t.id) },
        },
      });
    }

    // Проверка уникальности имен типов смен (исключая удаляемые)
    const remainingTypeNames = data.shiftTypes.map((st) => st.name.toLowerCase().trim());
    const uniqueRemainingNames = new Set(remainingTypeNames);
    if (remainingTypeNames.length !== uniqueRemainingNames.size) {
      throw new Error('Имена типов смен должны быть уникальными в рамках профиля');
    }

    // Обновляем или создаем типы смен и сохраняем маппинг временных ID на реальные
    const tempIdToRealId = new Map<string, string>();
    for (const shiftTypeData of data.shiftTypes) {
      if (shiftTypeData.id && existingTypeIds.has(shiftTypeData.id)) {
        // Проверяем, что имя уникально (исключая текущий тип)
        const nameConflict = data.shiftTypes.some(
          (st) =>
            st.id !== shiftTypeData.id &&
            st.name.toLowerCase().trim() === shiftTypeData.name.toLowerCase().trim()
        );
        if (nameConflict) {
          throw new Error(`Тип смены с именем "${shiftTypeData.name}" уже существует`);
        }

        // Обновляем существующий
        await tx.shiftType.update({
          where: { id: shiftTypeData.id },
          data: {
            name: shiftTypeData.name,
            startTime: shiftTypeData.startTime,
            endTime: shiftTypeData.endTime,
            breaks: shiftTypeData.breaks,
            nightHoursCount: shiftTypeData.nightHoursCount,
            workingHours: shiftTypeData.workingHours,
            color: (shiftTypeData as any).color || null,
            // color пока не хранится в БД, но сохраняем в breaks или отдельном поле JSON
          },
        });
      } else {
        // Создаем новый и сохраняем маппинг временного ID
        const createdType = await tx.shiftType.create({
          data: {
            shiftProfileId: id,
            name: shiftTypeData.name,
            startTime: shiftTypeData.startTime,
            endTime: shiftTypeData.endTime,
            breaks: shiftTypeData.breaks,
            nightHoursCount: shiftTypeData.nightHoursCount,
            workingHours: shiftTypeData.workingHours,
            color: (shiftTypeData as any).color || null,
          },
        });

        // Если был временный ID, сохраняем маппинг
        if (shiftTypeData.id && shiftTypeData.id.startsWith('temp-')) {
          tempIdToRealId.set(shiftTypeData.id, createdType.id);
        }
      }
    }

    // Обновляем паттерны: заменяем временные ID на реальные и обновляем/создаем
    const incomingPatternIds = new Set(
      data.patterns.map((p) => p.id).filter((id): id is string => !!id)
    );
    const existingPatternIds = new Set(existingPatterns.map((p) => p.id));

    // Удаляем паттерны, которых нет в новых данных
    const patternsToDelete = existingPatterns.filter((p) => !incomingPatternIds.has(p.id));
    if (patternsToDelete.length > 0) {
      await tx.shiftProfilePattern.deleteMany({
        where: {
          id: { in: patternsToDelete.map((p) => p.id) },
        },
      });
    }

    // Обновляем или создаем паттерны, заменяя временные ID на реальные
    for (const patternData of data.patterns) {
      // Заменяем временные ID типов смен на реальные в sequence
      const sequence = patternData.sequence.map((shiftTypeId) => {
        if (shiftTypeId && tempIdToRealId.has(shiftTypeId)) {
          return tempIdToRealId.get(shiftTypeId)!;
        }
        return shiftTypeId;
      });

      if (patternData.id && existingPatternIds.has(patternData.id)) {
        // Обновляем существующий
        await tx.shiftProfilePattern.update({
          where: { id: patternData.id },
          data: {
            patternNumber: patternData.patternNumber,
            cycleLength: patternData.cycleLength,
            sequence,
          },
        });
      } else {
        // Создаем новый
        await tx.shiftProfilePattern.create({
          data: {
            shiftProfileId: id,
            patternNumber: patternData.patternNumber,
            cycleLength: patternData.cycleLength,
            sequence,
          },
        });
      }
    }


    // Возвращаем обновленный профиль с деталями внутри транзакции
    return tx.shiftProfile.findUnique({
      where: { id },
      include: {
        shiftTypes: {
          orderBy: {
            startTime: 'asc',
          },
        },
        patterns: {
          orderBy: {
            patternNumber: 'asc',
          },
        },
      },
    });
  }).then((result) => {
    if (!result) {
      throw new Error('Failed to retrieve updated profile');
    }
    return result;
  });
}

/**
 * Сравнить несколько профилей смен
 * Вычисляет метрики для каждого профиля без сохранения в БД
 */
export async function compareProfiles(
  profileIds: string[],
  startDate: Date,
  endDate: Date
): Promise<CompareProfilesResponse> {
  // Валидация входных данных
  if (profileIds.length < 2) {
    throw new Error('Необходимо выбрать минимум 2 профиля для сравнения');
  }

  if (endDate <= startDate) {
    throw new Error('Конечная дата должна быть позже начальной');
  }

  // Загружаем все запрошенные профили
  const profiles = await prisma.shiftProfile.findMany({
    where: {
      id: { in: profileIds },
    },
    include: {
      shiftTypes: {
        orderBy: {
          startTime: 'asc',
        },
      },
      patterns: {
        orderBy: {
          patternNumber: 'asc',
        },
      },
    },
  });

  // Проверяем, что все профили найдены
  if (profiles.length !== profileIds.length) {
    throw new Error('Некоторые профили не найдены');
  }

  // Определяем максимальное количество сотрудников
  const maxEmployeeCount = Math.max(...profiles.map((p) => p.minEmployees));

  // Подготавливаем результаты сравнения
  const comparisons: ProfileComparisonResult[] = [];

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const periodDays = eachDayOfInterval({ start, end });

  // Для каждого профиля рассчитываем метрики
  for (const profile of profiles) {
    // Проверяем наличие паттернов
    if (!profile.patterns || profile.patterns.length === 0) {
      throw new Error(`Профиль "${profile.name}" не содержит паттернов`);
    }

    // Симулируем назначение смен без записи в БД
    const employeeMetrics: EmployeeProfileMetrics[] = [];
    const baseCycleStart = start;

    // Для каждого сотрудника (от 1 до maxEmployeeCount)
    for (let employeeNumber = 1; employeeNumber <= maxEmployeeCount; employeeNumber++) {
      const shifts: BulkShiftData[] = [];

      // Определяем паттерн для этого сотрудника (циклически)
      const patternIndex = (employeeNumber - 1) % profile.patterns.length;
      const pattern = profile.patterns[patternIndex];
      const sequence = pattern.sequence as (string | null)[];

      // Генерируем смены для этого сотрудника
      periodDays.forEach((currentDate) => {
        const positionInCycle = computePositionInCycle(
          currentDate,
          baseCycleStart,
          pattern.cycleLength,
          0
        );

        const shiftTypeId = sequence[positionInCycle];

        if (shiftTypeId) {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const day = currentDate.getDate();
          const normalizedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

          shifts.push({
            employeeId: `virtual-employee-${employeeNumber}`,
            date: normalizedDate,
            shiftTypeId,
          });
        }
      });

      // Рассчитываем метрики для этого сотрудника
      const shiftsCount = calculateShiftsCount(shifts);
      const totalHours = calculateTotalHours(shifts, profile.shiftTypes);
      const nightHours = calculateNightHours(shifts, profile.shiftTypes);
      const additionalMetrics = calculateAdditionalMetrics(shifts, profile.shiftTypes);

      employeeMetrics.push({
        employeeNumber,
        shiftsCount,
        totalHours,
        nightHours,
        additionalMetrics,
      });
    }

    // Подготавливаем визуализацию паттернов
    // Показываем период = max(cycleLength) + 2 дня
    const visualizationDays = profile.cycleLength + 2;
    const visualizedPatterns: VisualizedPattern[] = [];

    profile.patterns.forEach((pattern) => {
      const sequence = pattern.sequence as (string | null)[];
      const visualSequence: (ShiftTypeForVisualization | null)[] = [];

      // Берем только первые visualizationDays дней из паттерна
      for (let i = 0; i < Math.min(visualizationDays, sequence.length); i++) {
        const shiftTypeId = sequence[i];
        if (shiftTypeId) {
          const shiftType = profile.shiftTypes.find((st) => st.id === shiftTypeId);
          if (shiftType) {
            visualSequence.push({
              id: shiftType.id,
              name: shiftType.name,
              startTime: shiftType.startTime,
              endTime: shiftType.endTime,
              color: shiftType.color || undefined,
              workingHours: Number(shiftType.workingHours),
              nightHoursCount: shiftType.nightHoursCount,
            });
          } else {
            visualSequence.push(null);
          }
        } else {
          visualSequence.push(null);
        }
      }

      visualizedPatterns.push({
        patternNumber: pattern.patternNumber,
        sequence: visualSequence,
        cycleLength: pattern.cycleLength,
      });
    });

    // Добавляем результат для этого профиля
    const profileForComparison: ShiftProfileForComparison = {
      id: profile.id,
      name: profile.name,
      cycleLength: profile.cycleLength,
      minEmployees: profile.minEmployees,
      description: profile.description,
    };

    comparisons.push({
      profile: profileForComparison,
      employeeCount: maxEmployeeCount,
      employeeMetrics,
      visualizedPatterns,
      periodStart: start,
      periodEnd: end,
    });
  }

  return {
    comparisons,
    maxEmployeeCount,
  };
}

/**
 * Удалить профиль смены
 */
export async function deleteShiftProfile(id: string): Promise<void> {
  console.log('[deleteShiftProfile] Attempting to delete profile:', id);
  
  // Получаем все расписания, где этот профиль когда-либо использовался
  const allAssignments = await prisma.scheduleShiftAssignment.findMany({
    where: { shiftProfileId: id },
    include: {
      schedule: {
        select: { 
          id: true,
          name: true 
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log('[deleteShiftProfile] Found historical assignments:', allAssignments.length);

  if (allAssignments.length > 0) {
    // Группируем по scheduleId и проверяем только последнее назначение для каждого расписания
    const scheduleIds = [...new Set(allAssignments.map((a) => a.scheduleId))];
    const activeUsages: string[] = [];

    for (const scheduleId of scheduleIds) {
      // Получаем последнее назначение для этого расписания
      const latestAssignment = await prisma.scheduleShiftAssignment.findFirst({
        where: {
          scheduleId,
        },
        include: {
          schedule: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          { assignmentNumber: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      // Если последнее назначение использует этот профиль - профиль активен
      if (latestAssignment && latestAssignment.shiftProfileId === id) {
        activeUsages.push(latestAssignment.schedule.name);
      }
    }

    if (activeUsages.length > 0) {
      const scheduleNames = activeUsages.join(', ');
      console.log('[deleteShiftProfile] Profile is ACTIVELY used by schedules:', scheduleNames);
      throw new Error(
        `Невозможно удалить профиль. Он активно используется в расписаниях: ${scheduleNames}. ` +
        `Сначала примените другой профиль к этим расписаниям.`
      );
    }

    console.log('[deleteShiftProfile] Profile was used historically but is not active anymore');
  }

  console.log('[deleteShiftProfile] Profile is not actively used, proceeding with deletion');
  
  // Удаляем профиль (каскадное удаление типов смен и паттернов настроено в schema.prisma)
  // Исторические записи в ScheduleShiftAssignment также удалятся через onDelete: Cascade
  await prisma.shiftProfile.delete({
    where: { id },
  });
  
  console.log('[deleteShiftProfile] Profile deleted successfully');
}

/**
 * Получить информацию об использовании профиля в расписаниях
 */
export async function getProfileUsage(id: string): Promise<{
  isUsed: boolean;
  schedules: Array<{ id: string; name: string; assignmentCount: number }>;
}> {
  const assignments = await prisma.scheduleShiftAssignment.findMany({
    where: { shiftProfileId: id },
    include: {
      schedule: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Группируем по расписаниям
  const scheduleMap = new Map<string, { id: string; name: string; count: number }>();
  
  assignments.forEach((assignment) => {
    if (assignment.schedule) {
      const scheduleId = assignment.schedule.id;
      if (scheduleMap.has(scheduleId)) {
        scheduleMap.get(scheduleId)!.count++;
      } else {
        scheduleMap.set(scheduleId, {
          id: assignment.schedule.id,
          name: assignment.schedule.name,
          count: 1,
        });
      }
    }
  });

  const schedules = Array.from(scheduleMap.values()).map((s) => ({
    id: s.id,
    name: s.name,
    assignmentCount: s.count,
  }));

  return {
    isUsed: assignments.length > 0,
    schedules,
  };
}

/**
 * Клонировать профиль смены
 */
export async function cloneShiftProfile(id: string): Promise<ShiftProfileWithDetails> {
  // Получаем исходный профиль
  const sourceProfile = await getShiftProfileById(id);

  if (!sourceProfile) {
    throw new Error('Профиль не найден');
  }

  // Создаем клон через транзакцию
  return prisma.$transaction(async (tx) => {
    // Создаем новый профиль
    const newProfile = await tx.shiftProfile.create({
      data: {
        name: `${sourceProfile.name} (копия)`,
        description: sourceProfile.description,
        cycleLength: sourceProfile.cycleLength,
        minEmployees: sourceProfile.minEmployees,
      },
    });

    // Клонируем типы смен и создаем маппинг старых ID на новые
    const oldIdToNewId = new Map<string, string>();

    for (const shiftType of sourceProfile.shiftTypes) {
      const newShiftType = await tx.shiftType.create({
        data: {
          shiftProfileId: newProfile.id,
          name: shiftType.name,
          startTime: shiftType.startTime,
          endTime: shiftType.endTime,
          breaks: shiftType.breaks as any, // JsonValue приводим к any для совместимости
          nightHoursCount: shiftType.nightHoursCount,
          workingHours: shiftType.workingHours,
          color: shiftType.color,
        },
      });

      oldIdToNewId.set(shiftType.id, newShiftType.id);
    }

    // Клонируем паттерны с обновленными ID типов смен
    for (const pattern of sourceProfile.patterns) {
      const oldSequence = pattern.sequence as (string | null)[];
      const newSequence = oldSequence.map((shiftTypeId) => {
        if (shiftTypeId && oldIdToNewId.has(shiftTypeId)) {
          return oldIdToNewId.get(shiftTypeId)!;
        }
        return shiftTypeId;
      });

      await tx.shiftProfilePattern.create({
        data: {
          shiftProfileId: newProfile.id,
          patternNumber: pattern.patternNumber,
          cycleLength: pattern.cycleLength,
          sequence: newSequence,
        },
      });
    }

    // Возвращаем созданный профиль с деталями
    const result = await tx.shiftProfile.findUnique({
      where: { id: newProfile.id },
      include: {
        shiftTypes: {
          orderBy: {
            startTime: 'asc',
          },
        },
        patterns: {
          orderBy: {
            patternNumber: 'asc',
          },
        },
      },
    });

    if (!result) {
      throw new Error('Failed to retrieve cloned profile');
    }

    return result;
  });
}

