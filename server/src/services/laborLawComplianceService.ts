/**
 * Сервис проверки соответствия режима труда и отдыха требованиям ТК РФ
 */

import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma.js';
import { LaborViolationType, ViolationSeverity } from '@prisma/client';
import { 
  calculateWorkingHours,
  calculateProductionCalendar,
  calculateMonthlyHoursNorm
} from './productionCalendarService.js';
import { 
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  startOfDay,
  differenceInHours,
  isSameDay,
  addDays,
  parseISO
} from 'date-fns';

/**
 * Интерфейс для настроек минимального отдыха
 */
export interface MinRestInterval {
  shiftDuration: number;
  minRest: number;
}

/**
 * Интерфейс для настроек ТК РФ
 */
export interface LaborLawSettings {
  id: string;
  maxWorkingHoursPerShift: Decimal;
  minRestBetweenShifts: MinRestInterval[];
  maxHoursPerWeek: Decimal;
  maxHoursPerMonth: Decimal;
  maxHoursPerQuarter: Decimal;
  maxOvertimeHoursPerYear: Decimal;
  nightHoursStart: string;
  nightHoursEnd: string;
  includeBreaksInNightHours: boolean;
  maxConsecutiveWorkDays: number;
  maxNightShiftsPerWeek: number | null;
  enabledRules: string[];
  workHoursSource: string;
  customApiUrl: string | null;
  selectedYear: number | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Получить или создать настройки по умолчанию
 */
export async function getOrCreateDefaultSettings(): Promise<LaborLawSettings> {
  const existing = await prisma.laborLawSettings.findFirst();
  
  if (existing) {
    return existing as any;
  }

  // Создаем настройки по умолчанию
  const defaultSettings = await prisma.laborLawSettings.create({
    data: {
      maxWorkingHoursPerShift: 12,
      minRestBetweenShifts: [
        { shiftDuration: 12, minRest: 11 },
        { shiftDuration: 8, minRest: 8 },
        { shiftDuration: 6, minRest: 8 },
      ],
      maxHoursPerWeek: 40,
      maxHoursPerMonth: 166.67,
      maxHoursPerQuarter: 500,
      maxOvertimeHoursPerYear: 120,
      nightHoursStart: '22:00',
      nightHoursEnd: '06:00',
      includeBreaksInNightHours: false,
      maxConsecutiveWorkDays: 6,
      maxNightShiftsPerWeek: null,
      enabledRules: [
        'excessive_shift_hours',
        'insufficient_rest',
        'excessive_weekly_hours',
        'excessive_monthly_hours',
        'excessive_quarterly_hours',
        'excessive_yearly_hours',
        'excessive_consecutive_days',
      ],
      workHoursSource: 'production_calendar',
      customApiUrl: null,
      lastSyncAt: null,
    },
  });

  return defaultSettings as any;
}

/**
 * Обновить настройки контроля
 */
export async function updateSettings(
  data: Partial<Omit<LaborLawSettings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<LaborLawSettings> {
  const settings = await getOrCreateDefaultSettings();

  const updated = await prisma.laborLawSettings.update({
    where: { id: settings.id },
    data: data as any,
  });

  return updated as any;
}

/**
 * Получить норму часов для года
 */
export async function getWorkHoursNorm(year: number): Promise<number> {
  const norm = await prisma.workHoursNorm.findUnique({
    where: { year },
  });

  if (norm) {
    return Number(norm.totalHours);
  }

  // Если норма не найдена - рассчитываем автоматически
  const calculated = await calculateWorkingHours(year);
  
  // Сохраняем в БД
  await prisma.workHoursNorm.create({
    data: {
      year,
      totalHours: calculated,
      isManualOverride: false,
      source: 'production_calendar',
      metadata: await calculateProductionCalendar(year) as any,
    },
  });

  return calculated;
}

/**
 * Обновить норму часов (с флагом ручной корректировки)
 */
export async function updateWorkHoursNorm(
  year: number,
  hours: number,
  isManual: boolean = true
): Promise<void> {
  await prisma.workHoursNorm.upsert({
    where: { year },
    update: {
      totalHours: hours,
      isManualOverride: isManual,
      source: isManual ? 'manual' : 'production_calendar',
    },
    create: {
      year,
      totalHours: hours,
      isManualOverride: isManual,
      source: isManual ? 'manual' : 'production_calendar',
    },
  });
}

/**
 * Валидация расписания на соответствие ТК РФ
 */
export async function validateSchedule(scheduleId: string): Promise<{
  violationsCount: number;
  violations: any[];
}> {
  const settings = await getOrCreateDefaultSettings();
  
  // Удаляем старые нарушения для этого расписания
  await prisma.scheduleLaborViolation.deleteMany({
    where: { scheduleId },
  });

  const violations: any[] = [];

  // Получаем расписание с сотрудниками и сменами
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      employees: true,
      shifts: {
        include: {
          shiftType: true,
        },
        orderBy: {
          date: 'asc',
        },
      },
    },
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Проверяем каждого сотрудника
  for (const employee of schedule.employees) {
    const employeeShifts = schedule.shifts.filter(
      (s) => s.employeeId === employee.id && s.shiftTypeId !== null
    );

    if (employeeShifts.length === 0) continue;

    // 1. Проверка продолжительности смен
    if (settings.enabledRules.includes('excessive_shift_hours')) {
      const shiftViolations = await checkShiftDuration(
        employeeShifts,
        settings,
        scheduleId,
        employee.id
      );
      violations.push(...shiftViolations);
    }

    // 2. Проверка межсменных интервалов
    if (settings.enabledRules.includes('insufficient_rest')) {
      const restViolations = await checkRestBetweenShifts(
        employeeShifts,
        settings,
        scheduleId,
        employee.id
      );
      violations.push(...restViolations);
    }

    // 3. Проверка рабочих дней подряд
    // Проверка выполняется, если настройка maxConsecutiveWorkDays задана (больше 0)
    if (settings.maxConsecutiveWorkDays > 0) {
      const consecutiveViolations = await checkConsecutiveWorkDays(
        employeeShifts,
        settings,
        scheduleId,
        employee.id
      );
      violations.push(...consecutiveViolations);
    }

    // 4. Проверка недельных часов
    if (settings.enabledRules.includes('excessive_weekly_hours')) {
      if (schedule.reportingPeriod === 'week' || schedule.reportingPeriod === 'month') {
        const weeklyViolations = await checkWeeklyHours(
          employeeShifts,
          settings,
          scheduleId,
          employee.id,
          schedule
        );
        violations.push(...weeklyViolations);
      }
    }

    // 5. Проверка месячных часов
    if (settings.enabledRules.includes('excessive_monthly_hours')) {
      if (schedule.reportingPeriod === 'month') {
        const monthlyViolations = await checkMonthlyHours(
          employeeShifts,
          settings,
          scheduleId,
          employee.id,
          schedule
        );
        violations.push(...monthlyViolations);
      }
    }

    // 6. Проверка квартальных часов (пропускаем при годовом периоде)
    if (settings.enabledRules.includes('excessive_quarterly_hours') && schedule.reportingPeriod !== 'year') {
      const quarterlyViolations = await checkQuarterlyHours(
        employeeShifts,
        settings,
        scheduleId,
        employee.id,
        schedule
      );
      violations.push(...quarterlyViolations);
    }

    // 7. Проверка годовых часов
    if (settings.enabledRules.includes('excessive_yearly_hours')) {
      const yearlyViolations = await checkYearlyHours(
        employeeShifts,
        settings,
        scheduleId,
        employee.id,
        schedule
      );
      violations.push(...yearlyViolations);
    }

    // 8. Проверка ночных смен в неделю
    if (
      settings.enabledRules.includes('excessive_night_shifts') &&
      settings.maxNightShiftsPerWeek
    ) {
      const nightShiftViolations = await checkNightShiftsPerWeek(
        employeeShifts,
        settings,
        scheduleId,
        employee.id
      );
      violations.push(...nightShiftViolations);
    }
  }

  // Сохраняем нарушения в БД
  if (violations.length > 0) {
    await prisma.scheduleLaborViolation.createMany({
      data: violations,
    });
  }

  return {
    violationsCount: violations.length,
    violations,
  };
}

/**
 * Проверка продолжительности смены
 */
async function checkShiftDuration(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string
): Promise<any[]> {
  const violations: any[] = [];
  const maxHours = Number(settings.maxWorkingHoursPerShift);

  for (const shift of shifts) {
    if (!shift.shiftType) continue;

    const workingHours = Number(shift.shiftType.workingHours);
    
    if (workingHours > maxHours) {
      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.excessive_shift_hours,
        severity: ViolationSeverity.critical,
        dateFrom: shift.date,
        dateTo: shift.date,
        dailyShiftId: shift.id,
        actualValue: workingHours,
        expectedValue: maxHours,
        articleTkRf: 'Ст. 94 ТК РФ',
        description: `Продолжительность смены (${workingHours} ч.) превышает максимально допустимую (${maxHours} ч.)`,
      });
    }
  }

  return violations;
}

/**
 * Проверка межсменных интервалов
 */
async function checkRestBetweenShifts(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string
): Promise<any[]> {
  const violations: any[] = [];
  const restIntervals = settings.minRestBetweenShifts as MinRestInterval[];

  for (let i = 0; i < shifts.length - 1; i++) {
    const currentShift = shifts[i];
    const nextShift = shifts[i + 1];

    if (!currentShift.shiftType || !nextShift.shiftType) continue;

    // Вычисляем время окончания текущей смены и начала следующей
    const [currEndHours, currEndMinutes] = currentShift.shiftType.endTime.split(':').map(Number);
    const [nextStartHours, nextStartMinutes] = nextShift.shiftType.startTime.split(':').map(Number);

    const currentEndDate = new Date(currentShift.date);
    currentEndDate.setHours(currEndHours, currEndMinutes, 0, 0);

    // Если смена заканчивается на следующий день (ночная смена)
    if (currEndHours < 12 && currEndHours < Number(currentShift.shiftType.startTime.split(':')[0])) {
      currentEndDate.setDate(currentEndDate.getDate() + 1);
    }

    const nextStartDate = new Date(nextShift.date);
    nextStartDate.setHours(nextStartHours, nextStartMinutes, 0, 0);

    const restHours = differenceInHours(nextStartDate, currentEndDate);
    const currentShiftHours = Number(currentShift.shiftType.workingHours);

    // Находим минимально необходимый отдых для данной продолжительности смены
    let minRestRequired = 8; // по умолчанию
    for (const interval of restIntervals) {
      if (currentShiftHours >= interval.shiftDuration) {
        minRestRequired = Math.max(minRestRequired, interval.minRest);
      }
    }

    if (restHours < minRestRequired) {
      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.insufficient_rest,
        severity: ViolationSeverity.critical,
        dateFrom: currentShift.date,
        dateTo: nextShift.date,
        dailyShiftId: nextShift.id,
        actualValue: restHours,
        expectedValue: minRestRequired,
        articleTkRf: 'Ст. 110 ТК РФ',
        description: `Межсменный отдых (${restHours} ч.) меньше минимально допустимого (${minRestRequired} ч.) после смены продолжительностью ${currentShiftHours} ч.`,
      });
    }
  }

  return violations;
}

/**
 * Проверка рабочих дней подряд
 */
async function checkConsecutiveWorkDays(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string
): Promise<any[]> {
  const violations: any[] = [];
  const maxDays = settings.maxConsecutiveWorkDays;

  if (shifts.length === 0) {
    return violations;
  }

  // Нормализуем и сортируем даты к началу дня для корректного сравнения
  // Используем startOfDay для правильной обработки часовых поясов
  const normalizedShifts = shifts
    .map(shift => {
      // Обрабатываем разные форматы дат
      let date: Date;
      if (shift.date instanceof Date) {
        date = shift.date;
      } else if (typeof shift.date === 'string') {
        date = parseISO(shift.date);
      } else {
        // Если дата в неожиданном формате, пропускаем
        return null;
      }
      
      return {
        ...shift,
        date: startOfDay(date)
      };
    })
    .filter((shift): shift is NonNullable<typeof shift> => shift !== null)
    // Сортируем по дате на случай, если они не отсортированы
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (normalizedShifts.length === 0) {
    return violations;
  }

  let consecutiveDays = 1;
  let startDate: Date = normalizedShifts[0].date;

  for (let i = 1; i < normalizedShifts.length; i++) {
    const currentShift = normalizedShifts[i];
    const prevShift = normalizedShifts[i - 1];

    // Проверяем, что текущий день равен предыдущему + 1 день
    // Используем isSameDay для надежного сравнения дат
    const expectedNextDay = addDays(prevShift.date, 1);
    const isConsecutive = isSameDay(currentShift.date, expectedNextDay);

    if (isConsecutive) {
      // Дни идут подряд - увеличиваем счетчик
      consecutiveDays++;
    } else {
      // Дни не идут подряд - проверяем предыдущую серию и сбрасываем счетчик
      if (consecutiveDays > maxDays) {
        violations.push({
          scheduleId,
          employeeId,
          violationType: LaborViolationType.excessive_consecutive_days,
          severity: ViolationSeverity.warning,
          dateFrom: startDate,
          dateTo: prevShift.date,
          dailyShiftId: null,
          actualValue: consecutiveDays,
          expectedValue: maxDays,
          articleTkRf: 'Ст. 110 ТК РФ',
          description: `Работа ${consecutiveDays} дней подряд превышает максимально допустимые ${maxDays} дней`,
        });
      }
      
      // Начинаем новую серию
      consecutiveDays = 1;
      startDate = currentShift.date;
    }
  }

  // Проверка последней серии (если она не была проверена в цикле)
  if (consecutiveDays > maxDays) {
    const lastShift = normalizedShifts[normalizedShifts.length - 1];
    violations.push({
      scheduleId,
      employeeId,
      violationType: LaborViolationType.excessive_consecutive_days,
      severity: ViolationSeverity.warning,
      dateFrom: startDate,
      dateTo: lastShift.date,
      dailyShiftId: null,
      actualValue: consecutiveDays,
      expectedValue: maxDays,
      articleTkRf: 'Ст. 110 ТК РФ',
      description: `Работа ${consecutiveDays} дней подряд превышает максимально допустимые ${maxDays} дней`,
    });
  }

  return violations;
}

/**
 * Проверка недельных часов
 */
async function checkWeeklyHours(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string,
  schedule: any
): Promise<any[]> {
  const violations: any[] = [];
  const maxHoursPerWeek = Number(settings.maxHoursPerWeek);
  const allowOvertime = schedule.allowOvertimeWeekly || false;

  if (allowOvertime) {
    return violations; // Разрешены переработки
  }

  // Группируем смены по неделям
  const weekMap = new Map<string, any[]>();

  for (const shift of shifts) {
    if (!shift.shiftType) continue;

    const weekStart = startOfWeek(shift.date, { weekStartsOn: 1 }); // Понедельник
    const weekKey = weekStart.toISOString();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(shift);
  }

  // Проверяем каждую неделю
  for (const [weekKey, weekShifts] of weekMap) {
    const totalHours = weekShifts.reduce(
      (sum, shift) => sum + Number(shift.shiftType.workingHours),
      0
    );

    if (totalHours > maxHoursPerWeek) {
      const weekStart = parseISO(weekKey);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.excessive_weekly_hours,
        severity: ViolationSeverity.warning,
        dateFrom: weekStart,
        dateTo: weekEnd,
        dailyShiftId: null,
        actualValue: totalHours,
        expectedValue: maxHoursPerWeek,
        articleTkRf: 'Ст. 91 ТК РФ',
        description: `Отработано ${totalHours} ч. в неделю при норме ${maxHoursPerWeek} ч.`,
      });
    }
  }

  return violations;
}

/**
 * Проверка месячных часов
 */
async function checkMonthlyHours(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string,
  schedule: any
): Promise<any[]> {
  const violations: any[] = [];
  const allowOvertime = schedule.allowOvertimeMonthly || false;

  if (allowOvertime) {
    return violations;
  }

  // Группируем смены по месяцам
  const monthMap = new Map<string, any[]>();

  for (const shift of shifts) {
    if (!shift.shiftType) continue;

    const monthStart = startOfMonth(shift.date);
    const monthKey = monthStart.toISOString();

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(shift);
  }

  // Проверяем каждый месяц
  for (const [monthKey, monthShifts] of monthMap) {
    const totalHours = monthShifts.reduce(
      (sum, shift) => sum + Number(shift.shiftType.workingHours),
      0
    );

    const monthStart = parseISO(monthKey);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth() + 1; // getMonth() возвращает 0-11
    
    // Рассчитываем норму часов для этого месяца на основе производственного календаря
    // Используем selectedYear из настроек, если есть, иначе год из месяца
    const selectedYear = (settings as any).selectedYear || year;
    const monthlyNorm = await calculateMonthlyHoursNorm(selectedYear, month, Number(settings.maxHoursPerWeek));

    if (totalHours > monthlyNorm) {
      const monthEnd = endOfMonth(monthStart);

      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.excessive_monthly_hours,
        severity: ViolationSeverity.warning,
        dateFrom: monthStart,
        dateTo: monthEnd,
        dailyShiftId: null,
        actualValue: totalHours,
        expectedValue: monthlyNorm,
        articleTkRf: 'Ст. 91 ТК РФ',
        description: `Отработано ${totalHours} ч. в месяц при норме ${monthlyNorm} ч. (рассчитано для ${selectedYear} года)`,
      });
    }
  }

  return violations;
}

/**
 * Проверка квартальных часов
 */
async function checkQuarterlyHours(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string,
  schedule: any
): Promise<any[]> {
  const violations: any[] = [];
  const maxHoursPerQuarter = Number(settings.maxHoursPerQuarter);
  const allowOvertime = schedule.allowOvertimeQuarterly || false;

  if (allowOvertime) {
    return violations;
  }

  // Группируем смены по кварталам
  const quarterMap = new Map<string, any[]>();

  for (const shift of shifts) {
    if (!shift.shiftType) continue;

    const quarterStart = startOfQuarter(shift.date);
    const quarterKey = quarterStart.toISOString();

    if (!quarterMap.has(quarterKey)) {
      quarterMap.set(quarterKey, []);
    }
    quarterMap.get(quarterKey)!.push(shift);
  }

  // Проверяем каждый квартал
  for (const [quarterKey, quarterShifts] of quarterMap) {
    const totalHours = quarterShifts.reduce(
      (sum, shift) => sum + Number(shift.shiftType.workingHours),
      0
    );

    if (totalHours > maxHoursPerQuarter) {
      const quarterStart = parseISO(quarterKey);
      const quarterEnd = endOfQuarter(quarterStart);

      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.excessive_quarterly_hours,
        severity: ViolationSeverity.warning,
        dateFrom: quarterStart,
        dateTo: quarterEnd,
        dailyShiftId: null,
        actualValue: totalHours,
        expectedValue: maxHoursPerQuarter,
        articleTkRf: 'Ст. 91 ТК РФ',
        description: `Отработано ${totalHours} ч. в квартал при норме ${maxHoursPerQuarter} ч.`,
      });
    }
  }

  return violations;
}

/**
 * Проверка годовых часов
 */
async function checkYearlyHours(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string,
  _schedule: any // Не используется, но нужен для единообразия интерфейса
): Promise<any[]> {
  const violations: any[] = [];

  // Группируем смены по годам
  const yearMap = new Map<number, any[]>();

  for (const shift of shifts) {
    if (!shift.shiftType) continue;

    const year = shift.date.getFullYear();

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }
    yearMap.get(year)!.push(shift);
  }

  // Проверяем каждый год
  for (const [year, yearShifts] of yearMap) {
    const totalHours = yearShifts.reduce(
      (sum, shift) => sum + Number(shift.shiftType.workingHours),
      0
    );

    const yearNorm = await getWorkHoursNorm(year);
    const maxAllowed = yearNorm + Number(settings.maxOvertimeHoursPerYear);

    if (totalHours > maxAllowed) {
      const yearStart = startOfYear(new Date(year, 0, 1));
      const yearEnd = endOfYear(new Date(year, 11, 31));

      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.excessive_yearly_hours,
        severity: ViolationSeverity.critical,
        dateFrom: yearStart,
        dateTo: yearEnd,
        dailyShiftId: null,
        actualValue: totalHours,
        expectedValue: maxAllowed,
        articleTkRf: 'Ст. 91, 99 ТК РФ',
        description: `Отработано ${totalHours} ч. в год при норме ${yearNorm} ч. + допустимое превышение ${Number(settings.maxOvertimeHoursPerYear)} ч. = ${maxAllowed} ч.`,
      });
    }
  }

  return violations;
}

/**
 * Проверка ночных смен в неделю
 */
async function checkNightShiftsPerWeek(
  shifts: any[],
  settings: LaborLawSettings,
  scheduleId: string,
  employeeId: string
): Promise<any[]> {
  const violations: any[] = [];
  const maxNightShifts = settings.maxNightShiftsPerWeek;

  if (!maxNightShifts) return violations;

  // Группируем смены по неделям
  const weekMap = new Map<string, any[]>();

  for (const shift of shifts) {
    if (!shift.shiftType || shift.shiftType.nightHoursCount === 0) continue;

    const weekStart = startOfWeek(shift.date, { weekStartsOn: 1 });
    const weekKey = weekStart.toISOString();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(shift);
  }

  // Проверяем каждую неделю
  for (const [weekKey, weekShifts] of weekMap) {
    const nightShiftCount = weekShifts.length;

    if (nightShiftCount > maxNightShifts) {
      const weekStart = parseISO(weekKey);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      violations.push({
        scheduleId,
        employeeId,
        violationType: LaborViolationType.excessive_night_shifts,
        severity: ViolationSeverity.warning,
        dateFrom: weekStart,
        dateTo: weekEnd,
        dailyShiftId: null,
        actualValue: nightShiftCount,
        expectedValue: maxNightShifts,
        articleTkRf: 'Ст. 96 ТК РФ',
        description: `${nightShiftCount} ночных смен в неделю при максимуме ${maxNightShifts}`,
      });
    }
  }

  return violations;
}

/**
 * Получить нарушения для расписания
 */
export async function getViolationsForSchedule(
  scheduleId: string,
  filters?: {
    employeeId?: string;
    violationType?: LaborViolationType;
    severity?: ViolationSeverity;
    resolved?: boolean;
  }
): Promise<any[]> {
  const where: any = { scheduleId };

  if (filters?.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters?.violationType) {
    where.violationType = filters.violationType;
  }

  if (filters?.severity) {
    where.severity = filters.severity;
  }

  if (filters?.resolved !== undefined) {
    where.resolved = filters.resolved;
  }

  return prisma.scheduleLaborViolation.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          tabNumber: true,
        },
      },
      dailyShift: {
        include: {
          shiftType: true,
        },
      },
    },
    orderBy: {
      detectedAt: 'desc',
    },
  });
}

/**
 * Отметить нарушение как решенное
 */
export async function resolveViolation(
  violationId: string,
  notes: string
): Promise<void> {
  await prisma.scheduleLaborViolation.update({
    where: { id: violationId },
    data: {
      resolved: true,
      resolutionNotes: notes,
    },
  });
}

/**
 * Получить статистику нарушений для расписания
 */
export async function getViolationStats(scheduleId: string): Promise<{
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  resolved: number;
  unresolved: number;
}> {
  const violations = await prisma.scheduleLaborViolation.findMany({
    where: { scheduleId },
  });

  const stats = {
    total: violations.length,
    bySeverity: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    resolved: 0,
    unresolved: 0,
  };

  for (const violation of violations) {
    // По severity
    stats.bySeverity[violation.severity] =
      (stats.bySeverity[violation.severity] || 0) + 1;

    // По типу
    stats.byType[violation.violationType] =
      (stats.byType[violation.violationType] || 0) + 1;

    // Resolved/unresolved
    if (violation.resolved) {
      stats.resolved++;
    } else {
      stats.unresolved++;
    }
  }

  return stats;
}

