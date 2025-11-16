import { Shift, Employee } from '@types';
import { format, eachDayOfInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { shiftsService } from '@services/api/shiftsService';

export interface ShiftDifference {
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  mainScheduleShift: Shift | null;
  vacationModeShift: Shift | null;
  type: 'missing_in_vacation' | 'missing_in_main' | 'different_shift_type' | 'match';
}

export interface ComparisonStatistics {
  totalDays: number;
  totalEmployees: number;
  matchingShifts: number;
  differentShifts: number;
  missingInMain: number;
  missingInVacation: number;
}

export interface RosterComparisonResult {
  shiftsMainSchedule: Map<string, Shift>;
  shiftsVacationMode: Map<string, Shift>;
  differences: ShiftDifference[];
  statistics: ComparisonStatistics;
}

/**
 * Сравнение синхронности данных между ростером смен и ростером отпусков
 * 
 * ВАЖНО: Загружаем смены напрямую из БД для обоих ростеров, чтобы гарантировать актуальность данных
 * после повторной генерации смен snapshot может быть устаревшим
 */
export async function compareRosterSync(
  scheduleId: string,
  startDate: Date,
  endDate: Date,
  employees: Employee[]
): Promise<RosterComparisonResult> {
  // Нормализуем даты - используем startOfDay и endOfDay для корректного сравнения
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);

  console.log('[compareRosterSync] START', {
    scheduleId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    employeesCount: employees.length,
  });

  // Загружаем смены из ростера смен (MainSchedule) - напрямую из БД через API
  const mainScheduleShiftsResponse = await shiftsService.getShifts(scheduleId, {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: 10000,
  });

  const mainScheduleShiftsArray = Array.isArray(mainScheduleShiftsResponse)
    ? mainScheduleShiftsResponse
    : mainScheduleShiftsResponse.items || [];

  console.log('[compareRosterSync] MainSchedule shifts loaded', {
    scheduleId,
    shiftsCount: mainScheduleShiftsArray.length,
    sampleShifts: mainScheduleShiftsArray.slice(0, 3).map(s => ({
      id: s.id,
      employeeId: s.employeeId,
      date: typeof s.date === 'string' ? s.date : s.date.toISOString(),
      shiftTypeId: s.shiftTypeId,
    })),
  });

  // ВАЖНО: Загружаем смены из ростера отпусков (VacationMode) ТАКЖЕ напрямую из БД
  // Не используем snapshot, так как он может быть устаревшим после повторной генерации
  // Оба ростра должны сравниваться с актуальными данными из БД
  const vacationModeShiftsResponse = await shiftsService.getShifts(scheduleId, {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: 10000,
  });

  const vacationModeShiftsArray = Array.isArray(vacationModeShiftsResponse)
    ? vacationModeShiftsResponse
    : vacationModeShiftsResponse.items || [];

  console.log('[compareRosterSync] VacationMode shifts loaded', {
    scheduleId,
    shiftsCount: vacationModeShiftsArray.length,
    sampleShifts: vacationModeShiftsArray.slice(0, 3).map(s => ({
      id: s.id,
      employeeId: s.employeeId,
      date: typeof s.date === 'string' ? s.date : s.date.toISOString(),
      shiftTypeId: s.shiftTypeId,
    })),
  });

  // Создаем Map для быстрого доступа
  const shiftsMainSchedule = new Map<string, Shift>();
  const shiftsVacationMode = new Map<string, Shift>();

  // ВАЖНО: Нормализуем даты правильно - используем startOfDay для сравнения
  // Это гарантирует, что даты сравниваются корректно независимо от времени
  const normalizeDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
    const normalized = startOfDay(dateObj);
    return format(normalized, 'yyyy-MM-dd');
  };

  // Нормализуем даты и создаем ключи "YYYY-MM-DD-employeeId"
  mainScheduleShiftsArray.forEach((shift) => {
    const dateStr = normalizeDate(shift.date);
    const key = `${dateStr}-${shift.employeeId}`;
    shiftsMainSchedule.set(key, shift as Shift);
  });

  // Преобразуем смены из VacationMode в формат Shift (они уже из API, но нужно нормализовать даты)
  vacationModeShiftsArray.forEach((shift: any) => {
    const dateStr = normalizeDate(shift.date);
    const key = `${dateStr}-${shift.employeeId}`;
    
    // Смены уже из API, но нужно убедиться, что даты нормализованы
    const shiftObj: Shift = {
      id: shift.id,
      scheduleId: shift.scheduleId,
      employeeId: shift.employeeId,
      date: typeof shift.date === 'string' ? parseISO(shift.date.split('T')[0]) : startOfDay(new Date(shift.date)),
      shiftTypeId: shift.shiftTypeId,
      status: shift.status || 'scheduled',
      modifiedReason: shift.modifiedReason || null,
      createdAt: typeof shift.createdAt === 'string' ? parseISO(shift.createdAt) : new Date(shift.createdAt),
      updatedAt: typeof shift.updatedAt === 'string' ? parseISO(shift.updatedAt) : new Date(shift.updatedAt),
      shiftType: shift.shiftType || undefined,
      employee: undefined,
      conflicts: undefined,
    };
    
    shiftsVacationMode.set(key, shiftObj);
  });

  console.log('[compareRosterSync] Shifts normalized and mapped', {
    scheduleId,
    mainScheduleShiftsCount: shiftsMainSchedule.size,
    vacationModeShiftsCount: shiftsVacationMode.size,
    sampleKeys: Array.from(shiftsMainSchedule.keys()).slice(0, 5),
  });

  // Получаем все дни периода - используем startOfDay для каждого дня
  const periodDays = eachDayOfInterval({ start, end }).map(d => startOfDay(d));

  // Создаем карту сотрудников для быстрого доступа к именам
  const employeesMap = new Map<string, Employee>();
  employees.forEach((emp) => employeesMap.set(emp.id, emp));

  // Сравниваем смены
  const differences: ShiftDifference[] = [];
  let matchingShifts = 0;
  let differentShifts = 0;
  let missingInMain = 0;
  let missingInVacation = 0;

  periodDays.forEach((date) => {
    // ВАЖНО: Используем нормализованную дату для ключа
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');

    employees.forEach((employee) => {
      const key = `${dateStr}-${employee.id}`;
      const mainShift = shiftsMainSchedule.get(key) || null;
      const vacationShift = shiftsVacationMode.get(key) || null;

      // Определяем тип различия
      let type: ShiftDifference['type'] = 'match';

      // Пропускаем дни, когда оба отсутствуют (день без смены)
      // Но добавляем в различия, если есть хотя бы одна смена
      if (!mainShift && !vacationShift) {
        // Оба отсутствуют - это нормально (день без смены), не добавляем в различия
        return;
      } else if (!mainShift && vacationShift) {
        type = 'missing_in_main';
        missingInMain++;
      } else if (mainShift && !vacationShift) {
        type = 'missing_in_vacation';
        missingInVacation++;
      } else if (mainShift && vacationShift) {
        // Оба есть - сравниваем shiftTypeId
        const mainShiftTypeId = mainShift.shiftTypeId || null;
        const vacationShiftTypeId = vacationShift.shiftTypeId || null;

        if (mainShiftTypeId !== vacationShiftTypeId) {
          type = 'different_shift_type';
          differentShifts++;
        } else {
          type = 'match';
          matchingShifts++;
        }
      }

      // Добавляем в различия (включая совпадения для полной картины)
      differences.push({
        date: dateStr,
        employeeId: employee.id,
        employeeName: employee.fullName,
        mainScheduleShift: mainShift,
        vacationModeShift: vacationShift,
        type,
      });
    });
  });

  const statistics: ComparisonStatistics = {
    totalDays: periodDays.length,
    totalEmployees: employees.length,
    matchingShifts,
    differentShifts,
    missingInMain,
    missingInVacation,
  };

  console.log('[compareRosterSync] Comparison completed', {
    scheduleId,
    statistics,
    differencesCount: differences.length,
    sampleDifferences: differences
      .filter(d => d.type !== 'match')
      .slice(0, 5)
      .map(d => ({
        date: d.date,
        employeeName: d.employeeName,
        type: d.type,
        mainShiftTypeId: d.mainScheduleShift?.shiftTypeId || null,
        vacationShiftTypeId: d.vacationModeShift?.shiftTypeId || null,
      })),
  });

  return {
    shiftsMainSchedule,
    shiftsVacationMode,
    differences,
    statistics,
  };
}

