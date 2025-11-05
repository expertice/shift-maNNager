import { prisma } from '../lib/prisma';

export interface ScheduleAnalytics {
  scheduleId: string;
  totalHours: number;
  totalNightHours: number;
  averageHoursPerEmployee: number;
  coveragePercentage: number;
  employeeHoursMap: Record<string, number>;
  employeeNightHoursMap: Record<string, number>;
  conflictCount: number;
}

/**
 * Расчет аналитики расписания
 */
export async function calculateScheduleAnalytics(
  scheduleId: string
): Promise<ScheduleAnalytics> {
  // Получаем все смены схемы
  const shifts = await prisma.dailyShift.findMany({
    where: { scheduleId },
    include: {
      employee: true,
      shiftType: true,
    },
  });

  // Получаем всех сотрудников схемы
  const employees = await prisma.employee.findMany({
    where: { scheduleId },
  });

  // Получаем конфликты
  const conflicts = await prisma.conflict.findMany({
    where: {
      scheduleId,
      resolved: false,
    },
  });

  // Получаем период расписания
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Рассчитываем часы для каждого сотрудника
  const employeeHoursMap: Record<string, number> = {};
  const employeeNightHoursMap: Record<string, number> = {};

  // Инициализируем для всех сотрудников
  employees.forEach((emp) => {
    employeeHoursMap[emp.id] = 0;
    employeeNightHoursMap[emp.id] = 0;
  });

  let totalHours = 0;
  let totalNightHours = 0;

  shifts.forEach((shift) => {
    if (shift.shiftType) {
      const hours = Number(shift.shiftType.workingHours);
      const nightHours = shift.shiftType.nightHoursCount;

      totalHours += hours;
      totalNightHours += nightHours;

      employeeHoursMap[shift.employeeId] =
        (employeeHoursMap[shift.employeeId] || 0) + hours;
      employeeNightHoursMap[shift.employeeId] =
        (employeeNightHoursMap[shift.employeeId] || 0) + nightHours;
    }
  });

  // Рассчитываем средние часы на сотрудника
  const employeeCount = employees.length;
  const averageHoursPerEmployee = employeeCount > 0 ? totalHours / employeeCount : 0;

  // Рассчитываем процент покрытия
  // (упрощенная логика - можно улучшить на основе требований к минимальному покрытию)
  const periodDays =
    Math.ceil((schedule.endDate.getTime() - schedule.startDate.getTime()) / (1000 * 60 * 60 * 24)) +
    1;
  const totalPossibleShifts = periodDays * employeeCount;
  const actualShifts = shifts.length;
  const coveragePercentage =
    totalPossibleShifts > 0 ? (actualShifts / totalPossibleShifts) * 100 : 0;

  return {
    scheduleId,
    totalHours,
    totalNightHours,
    averageHoursPerEmployee,
    coveragePercentage,
    employeeHoursMap,
    employeeNightHoursMap,
    conflictCount: conflicts.length,
  };
}

