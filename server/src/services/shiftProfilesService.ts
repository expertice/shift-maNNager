import { prisma } from '../lib/prisma';
import { ShiftProfile, ShiftType, ShiftProfilePattern, RosterPatternInstance } from '@prisma/client';
import { computePositionInCycle, getSequenceFromPatternOrInstance, nextDayUtcStart, normalizeUtcStart } from '../utils/patternCycle';
import { bulkCreateShifts, BulkShiftData, deleteShiftsByPeriod } from './shiftsService';
import { startOfDay, eachDayOfInterval } from 'date-fns';
import { logger } from '../utils/logger';
import * as rosterSnapshotService from './rosterSnapshotService';
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
  scheduleId: string;
  name: string;
  description?: string | null;
  shiftTypes: UpdateShiftTypeData[];
  patterns: UpdateShiftPatternData[];
  // cycleLength и minEmployees вычисляются автоматически
}

/**
 * Получить все профили смен для конкретного расписания
 */
export async function getShiftProfilesBySchedule(scheduleId: string): Promise<ShiftProfileWithDetails[]> {
  return prisma.shiftProfile.findMany({
    where: {
      scheduleId,
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
    orderBy: {
      name: 'asc',
    },
  });
}

/**
 * Получить профиль смены по ID
 * @param id ID профиля
 * @param scheduleId Опциональный ID расписания для проверки принадлежности
 */
export async function getShiftProfileById(
  id: string, 
  scheduleId?: string
): Promise<ShiftProfileWithDetails | null> {
  const profile = await prisma.shiftProfile.findUnique({
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

  // Если указан scheduleId, проверяем принадлежность профиля к расписанию
  if (profile && scheduleId && profile.scheduleId !== scheduleId) {
    return null;
  }

  return profile;
}

/**
 * Генерация смен на основе профиля смены
 * Применяет паттерны к сотрудникам и создает смены на весь период
 */
export async function generateShiftsFromProfile(
  params: GenerateShiftsParams
): Promise<{ count: number; shifts: BulkShiftData[] }> {
  const { scheduleId, shiftProfileId, employeeIds, startDate, endDate } = params;

  // Получаем расписание для доступа к patternStartOffset
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { patternStartOffset: true },
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  const patternStartOffset = schedule.patternStartOffset ?? 0;
  
  // Проверяем, есть ли уже сгенерированные смены для этого расписания
  // Если смен нет, это первая генерация - нужно сбросить все startIndex в 0
  const existingShiftsCount = await prisma.dailyShift.count({
    where: {
      scheduleId,
      employee: {
        id: { in: employeeIds },
      },
    },
  });
  
  const isFirstGeneration = existingShiftsCount === 0;
  
  logger.info('[generateShiftsFromProfile] START', {
    scheduleId,
    shiftProfileId,
    employeeIdsCount: employeeIds.length,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    patternStartOffset,
    existingShiftsCount,
    isFirstGeneration,
    note: isFirstGeneration 
      ? 'First generation - will reset all startIndex to 0' 
      : 'Regeneration - will preserve startIndex for pattern offset',
  });

  // Получаем профиль с деталями
  const profile = await getShiftProfileById(shiftProfileId);

  if (!profile) {
    throw new Error('Shift profile not found');
  }

  // ВАЖНО: При генерации наполняем sequence паттернов, если они пустые
  // Sequence должен создаваться на основе типов смен из профиля
  if (!profile.shiftTypes || profile.shiftTypes.length === 0) {
    throw new Error('Profile has no shift types - cannot generate shifts');
  }

  // Проверяем и исправляем паттерны с пустым sequence
  const patternsToFix = profile.patterns?.filter(p => {
    const seq = p.sequence as (string | null)[] | undefined;
    if (!seq || seq.length === 0) {
      return true; // Пустой массив
    }
    // Проверяем, что есть хотя бы одно не-null значение
    const hasValidValue = seq.some(s => s !== null && s !== undefined && s !== '');
    return !hasValidValue; // Если нет валидных значений, это проблемный паттерн
  }) || [];

  if (patternsToFix.length > 0) {
    logger.info('[generateShiftsFromProfile] Generating sequence for patterns with empty sequence', {
      scheduleId,
      shiftProfileId,
      profileName: profile.name,
      patternsToFixCount: patternsToFix.length,
      shiftTypesCount: profile.shiftTypes.length,
    });

    // Генерируем sequence для каждого паттерна на основе типов смен
    // Комбинированная генерация: используем несколько типов смен в паттерне
    for (const pattern of patternsToFix) {
      const generatedSequence: (string | null)[] = [];
      
      // Для комбинированной генерации:
      // - Если типов смен больше 1, чередуем их с выходными
      // - Для паттерна номер N начинаем с типа смены (N-1) % shiftTypes.length
      // - Добавляем выходные дни для баланса
      
      if (profile.shiftTypes.length === 1) {
        // Если только один тип смены - заполняем все дни этим типом
        for (let i = 0; i < pattern.cycleLength; i++) {
          generatedSequence.push(profile.shiftTypes[0].id);
        }
      } else {
        // Комбинированная генерация: чередуем типы смен с выходными
        const startShiftTypeIndex = (pattern.patternNumber - 1) % profile.shiftTypes.length;
        
        for (let i = 0; i < pattern.cycleLength; i++) {
          // Каждый второй день - смена, остальные - выходные
          // Или можно сделать более сложную логику
          if (i % 2 === 0) {
            // Четные дни - смена
            const shiftTypeIndex = (startShiftTypeIndex + Math.floor(i / 2)) % profile.shiftTypes.length;
            generatedSequence.push(profile.shiftTypes[shiftTypeIndex].id);
          } else {
            // Нечетные дни - выходной
            generatedSequence.push(null);
          }
        }
      }
      
      // Обновляем sequence в БД
      await prisma.shiftProfilePattern.update({
        where: { id: pattern.id },
        data: { sequence: generatedSequence },
      });

      logger.info('[generateShiftsFromProfile] Pattern sequence generated', {
        patternId: pattern.id,
        patternNumber: pattern.patternNumber,
        cycleLength: pattern.cycleLength,
        generatedSequenceLength: generatedSequence.length,
        generatedSequence: generatedSequence.slice(0, 10), // Первые 10 элементов для отладки
        shiftTypesCount: profile.shiftTypes.length,
        note: 'Sequence generated with combined shift types',
      });
    }

    // Перезагружаем профиль с сгенерированными sequence
    const fixedProfile = await getShiftProfileById(shiftProfileId);
    if (fixedProfile) {
      Object.assign(profile, fixedProfile);
      logger.info('[generateShiftsFromProfile] Profile reloaded after generating sequences', {
        scheduleId,
        shiftProfileId,
        patternsCount: fixedProfile.patterns?.length || 0,
      });
    }
  }

  // ВАЖНО: Проверяем, что у профиля есть паттерны и они валидные
  logger.info('[generateShiftsFromProfile] Profile loaded', {
    scheduleId,
    shiftProfileId,
    profileName: profile.name,
    patternsCount: profile.patterns?.length || 0,
    patterns: profile.patterns?.map(p => ({
      id: p.id,
      patternNumber: p.patternNumber,
      cycleLength: p.cycleLength,
      sequenceLength: Array.isArray(p.sequence) ? p.sequence.length : 0,
      sequenceSample: Array.isArray(p.sequence) ? p.sequence.slice(0, 10) : null,
      sequenceHasNulls: Array.isArray(p.sequence) ? p.sequence.filter(s => s === null).length : 0,
      sequenceHasValues: Array.isArray(p.sequence) ? p.sequence.filter(s => s !== null && s !== undefined).length : 0,
      sequenceType: typeof p.sequence,
      sequenceIsArray: Array.isArray(p.sequence),
      sequenceRaw: p.sequence, // Полный sequence для отладки
    })),
  });

  if (!profile.patterns || profile.patterns.length === 0) {
    logger.error('[generateShiftsFromProfile] Profile has no patterns', {
      scheduleId,
      shiftProfileId,
      profileName: profile.name,
    });
    throw new Error('Shift profile has no patterns');
  }

  // Проверка уже выполнена выше - если мы дошли сюда, значит паттерны валидные

  // Предупреждаем о минимальном количестве сотрудников, но не блокируем генерацию
  if (employeeIds.length < profile.minEmployees) {
    console.warn(
      `[generateShifts] Warning: Fewer employees than recommended. Minimum: ${profile.minEmployees}, provided: ${employeeIds.length}`
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
  // ВАЖНО: ВСЕГДА перезагружаем экземпляры из БД, чтобы использовать актуальные startIndex
  // после обновления через updatePatternOffset
  const existingInstances = await prisma.rosterPatternInstance.findMany({
    where: { scheduleId, employeeId: { in: employeesToProcess } },
    include: { pattern: true },
  });
  
  logger.info('[generateShiftsFromProfile] Loaded existing instances with startIndex', {
    scheduleId,
    shiftProfileId,
    instancesCount: existingInstances.length,
    instances: existingInstances.map(inst => ({
      employeeId: inst.employeeId,
      startIndex: inst.startIndex,
      patternId: inst.patternId,
      hasPattern: !!inst.pattern,
      patternIdFromPattern: inst.pattern?.id,
      cycleLength: inst.pattern?.cycleLength,
      sequenceLength: inst.pattern ? (inst.pattern.sequence as any[]).length : 0,
      note: 'These startIndex values will be used for position calculation',
    })),
  });

  // ВАЖНО: Проверяем, что у всех экземпляров есть паттерны
  const instancesWithoutPattern = existingInstances.filter(inst => !inst.pattern);
  if (instancesWithoutPattern.length > 0) {
    logger.error('[generateShiftsFromProfile] Instances without pattern found', {
      scheduleId,
      shiftProfileId,
      instancesWithoutPatternCount: instancesWithoutPattern.length,
      instancesWithoutPattern: instancesWithoutPattern.map(inst => ({
        instanceId: inst.id,
        employeeId: inst.employeeId,
        patternId: inst.patternId,
        note: 'These instances have patternId but pattern is not loaded or does not exist',
      })),
    });
  }
  
  const employeeIdToInstance: Map<string, RosterPatternInstance & { pattern: ShiftProfilePattern | null }> = new Map(
    existingInstances.map((ri) => [ri.employeeId, ri])
  );

  const employeesWithoutInstance = employeesToProcess.filter((id) => !employeeIdToInstance.has(id));
  if (employeesWithoutInstance.length > 0) {
    // Получаем всех сотрудников с назначенным этим профилем для циклического распределения паттернов
    const allEmployeesWithProfile = await prisma.employee.findMany({
      where: {
        scheduleId,
        shiftProfileId: shiftProfileId,
      },
      orderBy: { id: 'asc' }, // Сортируем по ID для стабильности
      select: { id: true },
    });
    
    // Получаем все существующие экземпляры паттернов для сотрудников с этим профилем
    // чтобы определить, какие паттерны уже используются
    const allInstancesForProfile = await prisma.rosterPatternInstance.findMany({
      where: {
        scheduleId,
        employeeId: { in: allEmployeesWithProfile.map(emp => emp.id) },
        pattern: {
          shiftProfileId: shiftProfileId,
        },
      },
      include: {
        pattern: true,
      },
      orderBy: { createdAt: 'asc' }, // Сортируем по дате создания для правильного порядка
    });
    
    // Создаем карту: employeeId -> patternId для существующих экземпляров
    const existingPatternMap = new Map<string, string>();
    allInstancesForProfile.forEach(instance => {
      if (instance.patternId) {
        existingPatternMap.set(instance.employeeId, instance.patternId);
      }
    });
    
    // Определяем, какие паттерны уже используются (считаем по паттернам, не по сотрудникам)
    const usedPatternIndices = new Set<number>();
    allInstancesForProfile.forEach(instance => {
      if (instance.pattern) {
        const patternIndex = profile.patterns.findIndex(p => p.id === instance.patternId);
        if (patternIndex >= 0) {
          usedPatternIndices.add(patternIndex);
        }
      }
    });
    
    // Определяем последний использованный паттерн по дате создания
    // Находим самый новый экземпляр паттерна среди всех существующих
    let lastUsedPatternIndex: number | null = null;
    if (allInstancesForProfile.length > 0) {
      // Сортируем все экземпляры по дате создания (от старых к новым)
      const sortedInstances = [...allInstancesForProfile].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      
      // Берем последний экземпляр (самый новый по дате создания)
      const lastInstance = sortedInstances[sortedInstances.length - 1];
      if (lastInstance.patternId) {
        const foundIndex = profile.patterns.findIndex(p => p.id === lastInstance.patternId);
        if (foundIndex >= 0) {
          lastUsedPatternIndex = foundIndex;
        }
      }
    }
    
    // При первом назначении распределяем паттерны циклически на основе уже существующих назначений
    const toCreate: Parameters<typeof prisma.rosterPatternInstance.create>[0][] = [];
    for (const employeeId of employeesWithoutInstance) {
      // Если у сотрудника уже есть экземпляр паттерна (не должен попасть сюда, но на всякий случай)
      if (existingPatternMap.has(employeeId)) {
        continue; // Пропускаем, экземпляр уже существует
      }
      
      // Определяем следующий паттерн из цикла
      let patternIndex: number;
      if (lastUsedPatternIndex !== null) {
        // Если есть последний использованный паттерн, назначаем следующий по циклу
        patternIndex = (lastUsedPatternIndex + 1) % profile.patterns.length;
      } else {
        // Если паттернов еще не было назначено, начинаем с первого (индекс 0)
        patternIndex = 0;
      }
      
      const pattern = profile.patterns[patternIndex];
      const sequence = pattern.sequence as (string | null)[];
      
      // Обновляем lastUsedPatternIndex для следующего сотрудника
      lastUsedPatternIndex = patternIndex;
      
      // При создании новых экземпляров всегда начинаем с первого дня (startIndex = 0)
      // Смещение применяется только через кнопки в ростере (updatePatternOffset)
      toCreate.push({
        data: {
          scheduleId,
          employeeId,
          patternId: pattern.id,
          startIndex: 0, // Всегда начинаем с первого дня при генерации
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
  // ВАЖНО: НЕ сбрасываем startIndex к 0, сохраняем текущее значение для перемотки паттернов
  const updates: Parameters<typeof prisma.rosterPatternInstance.update>[0][] = [];
  const startIndexesBeforeUpdate: Array<{ employeeId: string; startIndex: number }> = [];
  
  for (let i = 0; i < employeesToProcess.length; i++) {
    const employeeId = employeesToProcess[i];
    const currentInstance = employeeIdToInstance.get(employeeId);
    const patternIndex = i % profile.patterns.length;
    const pattern = profile.patterns[patternIndex];
    const newSequence = pattern.sequence as (string | null)[];
    if (currentInstance) {
      startIndexesBeforeUpdate.push({
        employeeId,
        startIndex: currentInstance.startIndex,
      });
      
      const needsPatternChange = currentInstance.patternId !== pattern.id;
      const needsSequenceChange = JSON.stringify(currentInstance.sequence) !== JSON.stringify(newSequence);
      
      // ВАЖНО: При первой генерации (когда смен еще нет) сбрасываем startIndex в 0
      // При перегенерации после перемотки сохраняем текущий startIndex для перемотки паттернов
      // Также сбрасываем при изменении паттерна или последовательности
      const shouldResetStartIndex = isFirstGeneration || needsPatternChange || needsSequenceChange;
      
      if (shouldResetStartIndex) {
        const newStartIndex = isFirstGeneration ? 0 : (needsPatternChange || needsSequenceChange ? 0 : currentInstance.startIndex);
        
        logger.info('[generateShiftsFromProfile] Updating instance startIndex', {
          scheduleId,
          employeeId,
          currentStartIndex: currentInstance.startIndex,
          newStartIndex,
          reason: isFirstGeneration 
            ? 'first generation - reset to 0' 
            : needsPatternChange 
              ? 'pattern changed - reset to 0' 
              : 'sequence changed - reset to 0',
        });
        
        updates.push({
          where: { id: currentInstance.id },
          data: {
            patternId: pattern.id,
            sequence: newSequence,
            startIndex: newStartIndex,
          },
        });
      }
    }
  }
  
  logger.info('[generateShiftsFromProfile] Instance startIndexes before generation', {
    scheduleId,
    shiftProfileId,
    startIndexes: startIndexesBeforeUpdate,
    note: 'These startIndex values will be used for position calculation',
  });
  
  if (updates.length > 0) {
    logger.info('[generateShiftsFromProfile] Updating instances', {
      scheduleId,
      updatesCount: updates.length,
      note: 'Only updating instances with changed pattern/sequence',
    });
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
      
      // ВАЖНО: Проверяем, что у экземпляра есть паттерн
      if (instance && !instance.pattern) {
        logger.warn('[generateShiftsFromProfile] Instance without pattern', {
          scheduleId,
          employeeId,
          instanceId: instance.id,
          instancePatternId: instance.patternId,
          note: 'This instance has no pattern assigned - will use default pattern',
        });
      }
      
      // Если по какой-то причине экземпляра нет или у него нет паттерна — дефолтимся на первый паттерн
      const pattern = instance?.pattern ?? profile.patterns[0];
      
      if (!pattern) {
        logger.error('[generateShiftsFromProfile] No pattern available', {
          scheduleId,
          employeeId,
          hasInstance: !!instance,
          instancePatternId: instance?.patternId,
          profilePatternsCount: profile.patterns.length,
        });
        return; // Пропускаем этого сотрудника (в forEach используется return вместо continue)
      }

      // Используем startIndex из экземпляра для вычисления позиции
      // patternStartOffset используется только для отображения в UI (1/10, 2/10 и т.д.)
      // При генерации смен startIndex уже содержит правильное смещение
      const employeeOffset = instance?.startIndex ?? 0;
      const positionInCycle = computePositionInCycle(currentDate, baseCycleStart, pattern.cycleLength, employeeOffset);
      
      // Логирование для отслеживания использования startIndex при генерации
      if (employeeOffset !== 0 && Math.random() < 0.01) { // Логируем 1% случаев для производительности
        logger.debug('[generateShiftsFromProfile] Using startIndex for position calculation', {
          scheduleId,
          employeeId,
          currentDate: currentDate.toISOString(),
          baseCycleStart: baseCycleStart.toISOString(),
          cycleLength: pattern.cycleLength,
          employeeOffset,
          positionInCycle,
        });
      }

      // Получаем тип смены для этой позиции в паттерне (предпочитаем sequence из экземпляра)
      const sequence = getSequenceFromPatternOrInstance(instance?.sequence as (string | null)[] | undefined, pattern);
      
      // ВАЖНО: Проверяем, что sequence валидный
      if (!sequence || sequence.length === 0) {
        logger.error('[generateShiftsFromProfile] Invalid sequence', {
          scheduleId,
          employeeId,
          hasInstance: !!instance,
          instanceSequence: instance?.sequence,
          patternSequence: pattern?.sequence,
          patternId: pattern?.id,
          patternCycleLength: pattern?.cycleLength,
        });
        return; // Пропускаем этого сотрудника
      }
      
      // Проверяем, что positionInCycle в пределах sequence
      if (positionInCycle < 0 || positionInCycle >= sequence.length) {
        logger.error('[generateShiftsFromProfile] Position out of bounds', {
          scheduleId,
          employeeId,
          positionInCycle,
          sequenceLength: sequence.length,
          patternCycleLength: pattern?.cycleLength,
        });
        return; // Пропускаем этого сотрудника
      }
      
      const shiftTypeId = sequence[positionInCycle];

      // Логирование для отладки (только для первых нескольких итераций)
      if (shifts.length < 5 && Math.random() < 0.1) {
        logger.info('[generateShiftsFromProfile] Shift generation debug', {
          scheduleId,
          employeeId,
          currentDate: currentDate.toISOString(),
          hasInstance: !!instance,
          instancePatternId: instance?.patternId,
          patternId: pattern?.id,
          patternCycleLength: pattern?.cycleLength,
          sequenceLength: sequence?.length,
          positionInCycle,
          shiftTypeId,
          sequenceSample: sequence?.slice(0, 10),
          sequenceFull: sequence, // Полный sequence для отладки
        });
      }

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
  logger.info('[generateShiftsFromProfile] Shifts prepared for upsert', {
    scheduleId,
    shiftProfileId,
    totalShifts: shifts.length,
    sampleShifts: shifts.slice(0, 5).map((s) => ({ 
      employeeId: s.employeeId, 
      date: s.date.toISOString(), 
      shiftTypeId: s.shiftTypeId 
    })),
  });

  if (shifts.length === 0) {
    logger.warn('[generateShiftsFromProfile] No shifts to create', {
      scheduleId,
      shiftProfileId,
      employeesCount: employeesToProcess.length,
      periodDays: periodDays.length,
      note: 'This might indicate a problem with pattern generation',
    });
    return {
      count: 0,
      shifts: [],
    };
  }

  logger.info('[generateShiftsFromProfile] Calling bulkCreateShifts', {
    scheduleId,
    shiftsCount: shifts.length,
  });

  const count = await bulkCreateShifts(scheduleId, shifts);

  logger.info('[generateShiftsFromProfile] bulkCreateShifts completed', {
    scheduleId,
    requestedCount: shifts.length,
    savedCount: count,
  });

  // Обновляем shiftProfileId у сотрудников после успешной генерации
  await prisma.employee.updateMany({
    where: {
      scheduleId,
      id: { in: employeesToProcess },
    },
    data: {
      shiftProfileId: shiftProfileId,
    },
  });

  // ВАЖНО: НЕ сбрасываем patternStartOffset при генерации смен!
  // patternStartOffset используется для отображения в UI (1/10, 2/10 и т.д.)
  // Сброс происходит только при первой генерации или явном сбросе через UI
  // При перегенерации после перемотки patternStartOffset должен сохраняться
  const scheduleCurrent = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { patternStartOffset: true },
  });
  
  logger.info('[generateShiftsFromProfile] PatternStartOffset status', {
    scheduleId,
    currentPatternStartOffset: scheduleCurrent?.patternStartOffset ?? 0,
    note: 'patternStartOffset is NOT reset - it preserves the current offset for UI display',
    shiftsGenerated: count,
  });
  
  // НЕ обновляем patternStartOffset - он сохраняет текущее значение для отображения в UI

  // ВАЖНО: Обновление snapshot уже выполнено в bulkCreateShifts синхронно
  // Здесь не нужно вызывать syncRosterSnapshot повторно, чтобы избежать дублирования
  logger.info('[generateShiftsFromProfile] Shift generation completed', {
    scheduleId,
    shiftsGenerated: count,
    note: 'Roster snapshot was updated synchronously in bulkCreateShifts',
  });

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
        scheduleId: data.scheduleId,
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
  // Проверяем, что профиль принадлежит указанному расписанию
  const existingProfile = await prisma.shiftProfile.findUnique({
    where: { id },
  });

  if (!existingProfile) {
    throw new Error('Shift profile not found');
  }

  if (existingProfile.scheduleId !== data.scheduleId) {
    throw new Error('Shift profile does not belong to the specified schedule');
  }

  // Вычисляем автоматически cycleLength и minEmployees
  const cycleLength = calculateCycleLength(data.patterns);
  const minEmployees = calculateMinEmployees(data.patterns);

  // Начинаем транзакцию для атомарного обновления
  return prisma.$transaction(async (tx) => {
    // Обновляем основные поля профиля (scheduleId не меняется)
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
  endDate: Date,
  requestedEmployeeCount?: number
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

  // Определяем минимальное обязательное количество сотрудников (максимум по профилям)
  const maxEmployeeCount = Math.max(...profiles.map((p) => p.minEmployees));
  const employeeCount = Math.max(maxEmployeeCount, requestedEmployeeCount ?? maxEmployeeCount);

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

    // Для каждого сотрудника (от 1 до employeeCount)
    for (let employeeNumber = 1; employeeNumber <= employeeCount; employeeNumber++) {
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
      
      // Подсчитываем количество смен каждого типа
      const shiftTypeCounts: Record<string, number> = {};
      shifts.forEach((shift) => {
        if (shift.shiftTypeId) {
          shiftTypeCounts[shift.shiftTypeId] = (shiftTypeCounts[shift.shiftTypeId] || 0) + 1;
        }
      });

      // Рассчитываем общие часы: количество смен каждого типа * рабочие часы типа смены
      let totalHours = 0;
      Object.entries(shiftTypeCounts).forEach(([shiftTypeId, count]) => {
        const shiftType = profile.shiftTypes.find((st) => st.id === shiftTypeId);
        if (shiftType) {
          totalHours += count * Number(shiftType.workingHours);
        }
      });

      const nightHours = calculateNightHours(shifts, profile.shiftTypes);
      const additionalMetrics = calculateAdditionalMetrics(shifts, profile.shiftTypes);

      employeeMetrics.push({
        employeeNumber,
        shiftsCount,
        totalHours,
        nightHours,
        shiftTypeCounts,
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

    // Преобразуем типы смен для передачи в результат
    const shiftTypesForComparison: ShiftTypeForVisualization[] = profile.shiftTypes.map((st) => ({
      id: st.id,
      name: st.name,
      startTime: st.startTime,
      endTime: st.endTime,
      color: st.color || undefined,
      workingHours: Number(st.workingHours),
      nightHoursCount: st.nightHoursCount,
    }));

    comparisons.push({
      profile: profileForComparison,
      employeeCount,
      employeeMetrics,
      visualizedPatterns,
      shiftTypes: shiftTypesForComparison,
      periodStart: start,
      periodEnd: end,
    });
  }

  return {
    comparisons,
    maxEmployeeCount,
    employeeCount,
  };
}

/**
 * Удалить профиль смены
 */
export async function deleteShiftProfile(id: string, scheduleId: string): Promise<void> {
  console.log('[deleteShiftProfile] Attempting to delete profile:', id);
  
  // Проверяем, что профиль принадлежит указанному расписанию
  const profile = await prisma.shiftProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    throw new Error('Shift profile not found');
  }

  if (profile.scheduleId !== scheduleId) {
    throw new Error('Shift profile does not belong to the specified schedule');
  }
  
  // Получаем все назначения этого профиля в расписании
  const allAssignments = await prisma.scheduleShiftAssignment.findMany({
    where: { 
      shiftProfileId: id,
      scheduleId: scheduleId,
    },
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
    // Проверяем, является ли этот профиль последним использованным в расписании
      const latestAssignment = await prisma.scheduleShiftAssignment.findFirst({
        where: {
        scheduleId: scheduleId,
        },
        include: {
          schedule: {
            select: {
              name: true,
              status: true,
            },
          },
        },
        orderBy: [
          { assignmentNumber: 'desc' },
          { createdAt: 'desc' },
        ],
      });

    const ACTIVE_SCHEDULE_STATUSES: Array<'draft' | 'published'> = ['published'];

    // Если последнее назначение использует этот профиль и расписание активно - профиль активен
      if (
        latestAssignment &&
        latestAssignment.shiftProfileId === id &&
        latestAssignment.schedule.status &&
        ACTIVE_SCHEDULE_STATUSES.includes(latestAssignment.schedule.status)
      ) {
      console.log('[deleteShiftProfile] Profile is ACTIVELY used by schedule:', latestAssignment.schedule.name);
      throw new Error(
        `Невозможно удалить профиль. Он активно используется в расписании: ${latestAssignment.schedule.name}. ` +
        `Сначала примените другой профиль к этому расписанию.`
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
 * Получить информацию об использовании профиля в расписании
 * Профиль теперь привязан к одному расписанию, поэтому просто возвращаем количество применений
 */
export async function getProfileUsage(id: string): Promise<{
  isUsed: boolean;
  assignmentCount: number;
  scheduleId: string | null;
  scheduleName: string | null;
}> {
  const profile = await prisma.shiftProfile.findUnique({
    where: { id },
    include: {
      schedule: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!profile) {
    return {
      isUsed: false,
      assignmentCount: 0,
      scheduleId: null,
      scheduleName: null,
    };
  }

  const assignments = await prisma.scheduleShiftAssignment.findMany({
    where: { shiftProfileId: id },
  });

  return {
    isUsed: assignments.length > 0,
    assignmentCount: assignments.length,
    scheduleId: profile.scheduleId,
    scheduleName: profile.schedule.name,
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
    // Создаем новый профиль (клон остается в том же расписании)
    const newProfile = await tx.shiftProfile.create({
      data: {
        scheduleId: sourceProfile.scheduleId,
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

/**
 * Обновить смещение паттерна для всех экземпляров в расписании
 * @param scheduleId ID расписания
 * @param offsetDelta Изменение смещения (положительное = вправо, отрицательное = влево)
 */
export async function updatePatternOffset(
  scheduleId: string,
  offsetDelta: number
): Promise<void> {
  logger.info('[updatePatternOffset] START', {
    scheduleId,
    offsetDelta,
    timestamp: new Date().toISOString(),
  });

  // Получаем все экземпляры паттернов для расписания
  const instances = await prisma.rosterPatternInstance.findMany({
    where: { scheduleId },
    include: {
      pattern: true,
      employee: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  logger.info('[updatePatternOffset] Found instances', {
    scheduleId,
    instancesCount: instances.length,
    instances: instances.map(inst => ({
      instanceId: inst.id,
      employeeId: inst.employeeId,
      employeeName: inst.employee?.fullName,
      currentStartIndex: inst.startIndex,
      patternId: inst.patternId,
      patternCycleLength: inst.pattern?.cycleLength,
    })),
  });

  if (instances.length === 0) {
    logger.warn('[updatePatternOffset] No instances found, exiting', { scheduleId });
    return;
  }

  // Получаем текущее значение patternStartOffset из расписания
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { patternStartOffset: true },
  });

  if (!schedule) {
    logger.error('[updatePatternOffset] Schedule not found', { scheduleId });
    throw new Error('Schedule not found');
  }

  const currentOffset = schedule.patternStartOffset ?? 0;
  
  // ВАЖНО: patternStartOffset должен быть синхронизирован с реальными startIndex экземпляров
  // Если они не совпадают, используем среднее значение startIndex для синхронизации
  const avgStartIndex = instances.length > 0 
    ? Math.round(instances.reduce((sum, inst) => sum + (inst.startIndex || 0), 0) / instances.length)
    : 0;
  
  logger.info('[updatePatternOffset] Synchronization check', {
    scheduleId,
    currentPatternStartOffset: currentOffset,
    averageStartIndex: avgStartIndex,
    note: 'If these differ significantly, there may be a synchronization issue',
  });
  
  const newOffset = Math.max(0, currentOffset + offsetDelta);

  logger.info('[updatePatternOffset] Offset calculation', {
    scheduleId,
    currentPatternStartOffset: currentOffset,
    offsetDelta,
    calculatedNewOffset: currentOffset + offsetDelta,
    finalNewOffset: newOffset,
  });

  // Обновляем startIndex для каждого экземпляра с учетом длины цикла
  // Это сохраняет относительные смещения между сотрудниками
  const updates = instances.map((instance) => {
    if (!instance.pattern) {
      logger.warn('[updatePatternOffset] Instance without pattern', {
        instanceId: instance.id,
        employeeId: instance.employeeId,
      });
      return null;
    }

    const cycleLength = instance.pattern.cycleLength;
    const oldStartIndex = instance.startIndex;
    
    // Вычисляем новый startIndex с учетом циклического перехода
    // Используем текущий startIndex + offsetDelta для сохранения относительных смещений
    // ВАЖНО: Правильный расчет циклического перехода
    let newStartIndex = oldStartIndex + offsetDelta;
    
    // Нормализуем к диапазону [0, cycleLength)
    while (newStartIndex < 0) {
      newStartIndex += cycleLength;
    }
    newStartIndex = newStartIndex % cycleLength;

    // Логируем ВСЕ расчеты для отслеживания проблем при множественных шагах
    logger.info('[updatePatternOffset] Instance update calculation', {
      instanceId: instance.id,
      employeeId: instance.employeeId,
      employeeName: instance.employee?.fullName,
      cycleLength,
      oldStartIndex,
      offsetDelta,
      rawCalculation: oldStartIndex + offsetDelta,
      normalizedNewStartIndex: newStartIndex,
      verification: `(${oldStartIndex} + ${offsetDelta}) % ${cycleLength} = ${newStartIndex}`,
    });

    return prisma.rosterPatternInstance.update({
      where: { id: instance.id },
      data: { startIndex: newStartIndex },
    });
  }).filter((update): update is NonNullable<typeof update> => update !== null);

  logger.info('[updatePatternOffset] Executing transaction', {
    scheduleId,
    updatesCount: updates.length,
    newPatternStartOffset: newOffset,
  });

  // Обновляем patternStartOffset в расписании и экземпляры в одной транзакции
  await prisma.$transaction([
    ...updates,
    prisma.schedule.update({
      where: { id: scheduleId },
      data: { patternStartOffset: newOffset },
    }),
  ]);

  // ВАЖНО: Обновляем снимок ростера после смещения паттернов
  // Это обеспечивает синхронизацию с VacationMode
  try {
    logger.info('[updatePatternOffset] Updating roster snapshot after pattern offset change', {
      scheduleId,
      offsetDelta,
      newPatternStartOffset: newOffset,
    });
    await rosterSnapshotService.syncRosterSnapshot(scheduleId);
    logger.info('[updatePatternOffset] Roster snapshot updated successfully', {
      scheduleId,
    });
  } catch (error) {
    logger.error('[updatePatternOffset] Error updating roster snapshot', {
      scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  }

  // После обновления проверяем, что все startIndex обновлены правильно
  const updatedInstances = await prisma.rosterPatternInstance.findMany({
    where: { scheduleId },
    include: {
      pattern: true,
      employee: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  logger.info('[updatePatternOffset] SUCCESS - Verification', {
    scheduleId,
    offsetDelta,
    oldPatternStartOffset: currentOffset,
    newPatternStartOffset: newOffset,
    updatedInstancesCount: updates.length,
    verification: updatedInstances.map(inst => ({
      employeeId: inst.employeeId,
      employeeName: inst.employee?.fullName,
      finalStartIndex: inst.startIndex,
      cycleLength: inst.pattern?.cycleLength,
      isValid: inst.startIndex >= 0 && inst.startIndex < (inst.pattern?.cycleLength || 0),
    })),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Обновить смещение паттерна для конкретного сотрудника
 * @param scheduleId ID расписания
 * @param employeeId ID сотрудника
 * @param offsetDelta Изменение смещения (положительное = вправо, отрицательное = влево)
 */
export async function updateEmployeePatternOffset(
  scheduleId: string,
  employeeId: string,
  offsetDelta: number
): Promise<void> {
  // Получаем экземпляр паттерна для сотрудника
  const instance = await prisma.rosterPatternInstance.findFirst({
    where: {
      scheduleId,
      employeeId,
    },
    include: {
      pattern: true,
    },
  });

  if (!instance || !instance.pattern) {
    throw new Error('Pattern instance not found for employee');
  }

  const cycleLength = instance.pattern.cycleLength;
  if (cycleLength <= 0) {
    throw new Error('Pattern has invalid cycle length');
  }

  // Вычисляем новый startIndex с учетом циклического перехода
  let newStartIndex = (instance.startIndex + offsetDelta) % cycleLength;
  if (newStartIndex < 0) {
    newStartIndex = cycleLength + newStartIndex;
  }

  // Обновляем startIndex для экземпляра паттерна
  await prisma.rosterPatternInstance.update({
    where: { id: instance.id },
    data: { startIndex: newStartIndex },
  });

  // ВАЖНО: Обновляем снимок ростера после смещения паттерна сотрудника
  // Это обеспечивает синхронизацию с VacationMode
  try {
    logger.info('[updateEmployeePatternOffset] Updating roster snapshot after employee pattern offset change', {
      scheduleId,
      employeeId,
      offsetDelta,
      newStartIndex,
    });
    await rosterSnapshotService.syncRosterSnapshot(scheduleId);
    logger.info('[updateEmployeePatternOffset] Roster snapshot updated successfully', {
      scheduleId,
      employeeId,
    });
  } catch (error) {
    logger.error('[updateEmployeePatternOffset] Error updating roster snapshot', {
      scheduleId,
      employeeId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Не прерываем выполнение, если обновление снимка не удалось
  }
}

