/**
 * Контроллер для управления проверкой соответствия ТК РФ
 */

import { Request, Response, NextFunction } from 'express';
import { 
  getOrCreateDefaultSettings,
  updateSettings,
  getWorkHoursNorm,
  updateWorkHoursNorm,
  validateSchedule,
  getViolationsForSchedule,
  resolveViolation,
  getViolationStats,
} from '../services/laborLawComplianceService.js';
import { 
  calculateWorkingHours,
  calculateProductionCalendar 
} from '../services/productionCalendarService.js';
import prisma from '../lib/prisma.js';
import { LaborViolationType, ViolationSeverity } from '@prisma/client';

export interface AuthRequest extends Request {
  userId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Получить настройки контроля ТК РФ
 */
export async function getSettings(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await getOrCreateDefaultSettings();

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Обновить настройки контроля ТК РФ
 */
export async function updateSettingsController(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const updates = req.body;
    const settings = await updateSettings(updates);

    res.json({
      success: true,
      data: settings,
      message: 'Настройки успешно обновлены',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Получить все нормы часов
 */
export async function getAllWorkHoursNorms(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const norms = await prisma.workHoursNorm.findMany({
      orderBy: {
        year: 'desc',
      },
    });

    res.json({
      success: true,
      data: norms,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Получить норму часов для конкретного года
 */
export async function getWorkHoursNormByYear(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const year = parseInt(req.params.year);

    if (isNaN(year)) {
      res.status(400).json({
        success: false,
        error: 'Неверный формат года',
      });
      return;
    }

    const hours = await getWorkHoursNorm(year);

    res.json({
      success: true,
      data: { year, totalHours: hours },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Обновить норму часов вручную
 */
export async function updateWorkHoursNormController(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const year = parseInt(req.params.year);
    const { hours, isManual } = req.body;

    if (isNaN(year) || typeof hours !== 'number') {
      res.status(400).json({
        success: false,
        error: 'Неверные параметры',
      });
      return;
    }

    await updateWorkHoursNorm(year, hours, isManual !== false);

    res.json({
      success: true,
      message: 'Норма часов успешно обновлена',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Синхронизировать норму из внешнего источника
 */
export async function syncWorkHoursNorm(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const year = parseInt(req.params.year);
    const { source } = req.body;

    if (isNaN(year)) {
      res.status(400).json({
        success: false,
        error: 'Неверный формат года',
      });
      return;
    }

    // TODO: Реализовать синхронизацию с внешними источниками (Consultant.ru, custom API)
    // Пока используем расчет из производственного календаря
    const calculated = await calculateWorkingHours(year);
    const calendar = await calculateProductionCalendar(year);

    await prisma.workHoursNorm.upsert({
      where: { year },
      update: {
        totalHours: calculated,
        isManualOverride: false,
        source: source || 'production_calendar',
        workingDays: calendar.workingDays,
        weekendDays: calendar.weekendDays,
        holidayDays: calendar.holidayDays,
        metadata: calendar,
      },
      create: {
        year,
        totalHours: calculated,
        isManualOverride: false,
        source: source || 'production_calendar',
        workingDays: calendar.workingDays,
        weekendDays: calendar.weekendDays,
        holidayDays: calendar.holidayDays,
        metadata: calendar,
      },
    });

    res.json({
      success: true,
      message: 'Норма часов успешно синхронизирована',
      data: { year, totalHours: calculated },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Пересчитать норму из производственного календаря
 */
export async function calculateWorkHoursNormController(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const year = parseInt(req.params.year);

    if (isNaN(year)) {
      res.status(400).json({
        success: false,
        error: 'Неверный формат года',
      });
      return;
    }

    const calculated = await calculateWorkingHours(year);
    const calendar = await calculateProductionCalendar(year);

    await prisma.workHoursNorm.upsert({
      where: { year },
      update: {
        totalHours: calculated,
        isManualOverride: false,
        source: 'production_calendar',
        workingDays: calendar.workingDays,
        weekendDays: calendar.weekendDays,
        holidayDays: calendar.holidayDays,
        metadata: calendar,
      },
      create: {
        year,
        totalHours: calculated,
        isManualOverride: false,
        source: 'production_calendar',
        workingDays: calendar.workingDays,
        weekendDays: calendar.weekendDays,
        holidayDays: calendar.holidayDays,
        metadata: calendar,
      },
    });

    res.json({
      success: true,
      message: 'Норма часов успешно пересчитана',
      data: { year, totalHours: calculated, calendar },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Запустить проверку расписания вручную
 */
export async function validateScheduleController(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;

    const result = await validateSchedule(scheduleId);

    res.json({
      success: true,
      data: result,
      message: `Проверка завершена. Найдено нарушений: ${result.violationsCount}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Получить нарушения для расписания
 */
export async function getViolations(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeId, violationType, severity, resolved } = req.query;

    const filters: any = {};

    if (employeeId) {
      filters.employeeId = String(employeeId);
    }

    if (violationType) {
      filters.violationType = violationType as LaborViolationType;
    }

    if (severity) {
      filters.severity = severity as ViolationSeverity;
    }

    if (resolved !== undefined) {
      filters.resolved = resolved === 'true';
    }

    const violations = await getViolationsForSchedule(scheduleId, filters);

    res.json({
      success: true,
      data: violations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Отметить нарушение как решенное
 */
export async function resolveViolationController(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { violationId } = req.params;
    const { notes } = req.body;

    await resolveViolation(violationId, notes || '');

    res.json({
      success: true,
      message: 'Нарушение отмечено как решенное',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Получить статистику нарушений для расписания
 */
export async function getViolationStatsController(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;

    const stats = await getViolationStats(scheduleId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

