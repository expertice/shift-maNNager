import { prisma } from '../lib/prisma';
import { VacationRule, EmployeeVacationAllocation } from '@prisma/client';

export interface VacationRulesData {
  availableDays?: number;
  minContinuousDays?: number;
  maxConcurrentEmployees?: number;
}

export interface EmployeeAllocationData {
  employeeId: string;
  year: number;
  allocatedDays: number;
}

/**
 * Получить правила отпусков для схемы
 */
export async function getVacationRules(scheduleId: string): Promise<VacationRule | null> {
  return prisma.vacationRule.findUnique({
    where: { scheduleId },
  });
}

/**
 * Создать или обновить правила отпусков
 */
export async function updateVacationRules(
  scheduleId: string,
  data: VacationRulesData
): Promise<VacationRule> {
  return prisma.vacationRule.upsert({
    where: { scheduleId },
    create: {
      scheduleId,
      availableDays: data.availableDays ?? 28,
      minContinuousDays: data.minContinuousDays ?? 14,
      maxConcurrentEmployees: data.maxConcurrentEmployees ?? 1,
    },
    update: {
      ...(data.availableDays !== undefined && { availableDays: data.availableDays }),
      ...(data.minContinuousDays !== undefined && { minContinuousDays: data.minContinuousDays }),
      ...(data.maxConcurrentEmployees !== undefined && { maxConcurrentEmployees: data.maxConcurrentEmployees }),
    },
  });
}

/**
 * Получить все выделения дней отпуска для схемы
 */
export async function getEmployeeAllocations(
  scheduleId: string,
  year?: number
): Promise<EmployeeVacationAllocation[]> {
  const where: any = { scheduleId };
  if (year !== undefined) {
    where.year = year;
  }

  return prisma.employeeVacationAllocation.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          tabNumber: true,
        },
      },
    },
    orderBy: [
      { year: 'desc' },
      { employee: { fullName: 'asc' } },
    ],
  });
}

/**
 * Получить выделение дней отпуска для конкретного сотрудника
 */
export async function getEmployeeAllocation(
  scheduleId: string,
  employeeId: string,
  year: number
): Promise<EmployeeVacationAllocation | null> {
  return prisma.employeeVacationAllocation.findUnique({
    where: {
      scheduleId_employeeId_year: {
        scheduleId,
        employeeId,
        year,
      },
    },
  });
}

/**
 * Создать или обновить выделение дней отпуска для сотрудника
 */
export async function updateEmployeeAllocation(
  scheduleId: string,
  employeeId: string,
  year: number,
  allocatedDays: number
): Promise<EmployeeVacationAllocation> {
  // Проверяем, что сотрудник принадлежит схеме
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      scheduleId,
    },
  });

  if (!employee) {
    throw new Error('Employee not found in this schedule');
  }

  return prisma.employeeVacationAllocation.upsert({
    where: {
      scheduleId_employeeId_year: {
        scheduleId,
        employeeId,
        year,
      },
    },
    create: {
      scheduleId,
      employeeId,
      year,
      allocatedDays,
    },
    update: {
      allocatedDays,
    },
  });
}

/**
 * Обновить выделения дней отпуска для нескольких сотрудников (bulk)
 */
export async function updateEmployeeAllocations(
  scheduleId: string,
  allocations: EmployeeAllocationData[]
): Promise<EmployeeVacationAllocation[]> {
  // Проверяем, что все сотрудники принадлежат схеме
  const employeeIds = allocations.map(a => a.employeeId);
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      scheduleId,
    },
    select: { id: true },
  });

  const validEmployeeIds = new Set(employees.map(e => e.id));
  const invalidIds = employeeIds.filter(id => !validEmployeeIds.has(id));

  if (invalidIds.length > 0) {
    throw new Error(`Employees not found in this schedule: ${invalidIds.join(', ')}`);
  }

  // Выполняем upsert для каждого выделения
  const results = await Promise.all(
    allocations.map(allocation =>
      updateEmployeeAllocation(
        scheduleId,
        allocation.employeeId,
        allocation.year,
        allocation.allocatedDays
      )
    )
  );

  return results;
}

/**
 * Вычислить использованные дни отпуска для сотрудника за год
 */
export async function getUsedVacationDays(
  _scheduleId: string,
  employeeId: string,
  year: number,
  excludeVacationId?: string
): Promise<number> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const vacations = await prisma.vacation.findMany({
    where: {
      employeeId,
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
      status: { in: ['approved', 'pending'] },
      ...(excludeVacationId && { id: { not: excludeVacationId } }),
    },
  });

  let totalDays = 0;
  for (const vacation of vacations) {
    const start = new Date(Math.max(vacation.startDate.getTime(), yearStart.getTime()));
    const end = new Date(Math.min(vacation.endDate.getTime(), yearEnd.getTime()));
    
    // Вычисляем количество дней включительно
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    totalDays += days;
  }

  return totalDays;
}

/**
 * Проверить лимит одновременных отпусков на дату
 */
export async function checkConcurrentVacationsLimit(
  scheduleId: string,
  startDate: Date,
  endDate: Date,
  maxConcurrent: number,
  excludeVacationId?: string
): Promise<{ valid: boolean; date?: Date; count?: number }> {
  // Получаем все даты в периоде
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Для каждой даты проверяем количество сотрудников в отпуске
  for (const date of dates) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    // Получаем всех сотрудников схемы
    const employees = await prisma.employee.findMany({
      where: { scheduleId },
      select: { id: true },
    });

    const employeeIds = employees.map(e => e.id);

    // Подсчитываем количество сотрудников в отпуске на эту дату
    const vacationsOnDate = await prisma.vacation.findMany({
      where: {
        employeeId: { in: employeeIds },
        startDate: { lte: dateEnd },
        endDate: { gte: dateStart },
        status: { in: ['approved', 'pending'] },
        ...(excludeVacationId && { id: { not: excludeVacationId } }),
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });

    const count = vacationsOnDate.length;
    if (count >= maxConcurrent) {
      return {
        valid: false,
        date: new Date(date),
        count,
      };
    }
  }

  return { valid: true };
}

/**
 * Проверить, есть ли предупреждение о минимальной длине периода отпуска
 * Возвращает предупреждение, если осталось меньше дней, чем минимальная длина периода,
 * и нет периода отпуска такой длины
 */
export async function checkMinContinuousDaysWarning(
  scheduleId: string,
  employeeId: string,
  year: number
): Promise<{ hasWarning: boolean; message?: string }> {
  // Получаем правила отпусков
  const rules = await getVacationRules(scheduleId);
  
  if (!rules || !rules.minContinuousDays) {
    return { hasWarning: false };
  }

  // Получаем выделенные дни
  const allocation = await getEmployeeAllocation(scheduleId, employeeId, year);
  
  // Используем allocation, если есть, иначе используем значение из правил
  const allocatedDays = allocation?.allocatedDays ?? (rules?.availableDays ?? 28);
  
  if (allocatedDays === 0) {
    return { hasWarning: false };
  }

  // Получаем использованные дни
  const usedDays = await getUsedVacationDays(scheduleId, employeeId, year);
  const remainingDays = allocatedDays - usedDays;

  // Если осталось дней больше или равно минимальной длине - предупреждения нет
  if (remainingDays >= rules.minContinuousDays) {
    return { hasWarning: false };
  }

  // Если осталось меньше дней, чем минимальная длина - проверяем, есть ли период такой длины
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const vacations = await prisma.vacation.findMany({
    where: {
      employeeId,
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
      status: { in: ['approved', 'pending'] },
    },
  });

  // Проверяем, есть ли хотя бы один период отпуска длиной >= minContinuousDays
  let hasLongPeriod = false;
  for (const vacation of vacations) {
    const start = new Date(Math.max(vacation.startDate.getTime(), yearStart.getTime()));
    const end = new Date(Math.min(vacation.endDate.getTime(), yearEnd.getTime()));
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (days >= rules.minContinuousDays) {
      hasLongPeriod = true;
      break;
    }
  }

  // Если нет периода нужной длины - возвращаем предупреждение
  if (!hasLongPeriod) {
    return {
      hasWarning: true,
      message: `Обязательная длина периода отпуска (${rules.minContinuousDays} дней): Осталось ${remainingDays} дней отпуска, что меньше минимальной длины периода. У вас нет периода отпуска длиной ${rules.minContinuousDays} дней или более. Рекомендуется пересмотреть распределение отпусков.`,
    };
  }

  return { hasWarning: false };
}

