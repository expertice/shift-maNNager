import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import * as vacationRulesService from '../services/vacationRulesService';
import { VacationRule, EmployeeVacationAllocation } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/vacation-rules
 * Получить правила отпусков для схемы
 */
export async function getVacationRules(
  req: AuthRequest,
  res: Response<ApiResponse<VacationRule | null>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;

    const rules = await vacationRulesService.getVacationRules(scheduleId);

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/vacation-rules
 * Обновить правила отпусков для схемы
 */
export async function updateVacationRules(
  req: AuthRequest,
  res: Response<ApiResponse<VacationRule>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { availableDays, minContinuousDays, maxConcurrentEmployees } = req.body;

    if (availableDays !== undefined && (typeof availableDays !== 'number' || availableDays < 0)) {
      res.status(400).json({
        success: false,
        error: 'availableDays must be a non-negative number',
      });
      return;
    }

    if (minContinuousDays !== undefined && (typeof minContinuousDays !== 'number' || minContinuousDays < 1)) {
      res.status(400).json({
        success: false,
        error: 'minContinuousDays must be a positive number',
      });
      return;
    }

    if (maxConcurrentEmployees !== undefined && (typeof maxConcurrentEmployees !== 'number' || maxConcurrentEmployees < 1)) {
      res.status(400).json({
        success: false,
        error: 'maxConcurrentEmployees must be a positive number',
      });
      return;
    }

    const rules = await vacationRulesService.updateVacationRules(scheduleId, {
      availableDays,
      minContinuousDays,
      maxConcurrentEmployees,
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/schedules/:scheduleId/vacation-allocations
 * Получить все выделения дней отпуска для схемы
 */
export async function getEmployeeAllocations(
  req: AuthRequest,
  res: Response<ApiResponse<EmployeeVacationAllocation[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { year } = req.query;

    const yearNum = year ? parseInt(year as string, 10) : undefined;
    if (year && isNaN(yearNum!)) {
      res.status(400).json({
        success: false,
        error: 'year must be a valid number',
      });
      return;
    }

    const allocations = await vacationRulesService.getEmployeeAllocations(
      scheduleId,
      yearNum
    );

    res.json({
      success: true,
      data: allocations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/vacation-allocations
 * Обновить выделения дней отпуска для нескольких сотрудников (bulk)
 */
export async function updateEmployeeAllocations(
  req: AuthRequest,
  res: Response<ApiResponse<EmployeeVacationAllocation[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { allocations } = req.body;

    if (!Array.isArray(allocations)) {
      res.status(400).json({
        success: false,
        error: 'allocations must be an array',
      });
      return;
    }

    // Валидация структуры массива
    for (const allocation of allocations) {
      if (!allocation.employeeId || typeof allocation.employeeId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Each allocation must have a valid employeeId',
        });
        return;
      }

      if (typeof allocation.year !== 'number' || allocation.year < 2000 || allocation.year > 2100) {
        res.status(400).json({
          success: false,
          error: 'Each allocation must have a valid year (2000-2100)',
        });
        return;
      }

      if (typeof allocation.allocatedDays !== 'number' || allocation.allocatedDays < 0) {
        res.status(400).json({
          success: false,
          error: 'Each allocation must have a non-negative allocatedDays',
        });
        return;
      }
    }

    const result = await vacationRulesService.updateEmployeeAllocations(
      scheduleId,
      allocations
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/schedules/:scheduleId/vacation-allocations/:employeeId/:year
 * Получить выделение дней отпуска для конкретного сотрудника
 */
export async function getEmployeeAllocation(
  req: AuthRequest,
  res: Response<ApiResponse<EmployeeVacationAllocation | null>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId, year } = req.params;

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum)) {
      res.status(400).json({
        success: false,
        error: 'year must be a valid number',
      });
      return;
    }

    const allocation = await vacationRulesService.getEmployeeAllocation(
      scheduleId,
      employeeId,
      yearNum
    );

    res.json({
      success: true,
      data: allocation,
    });
  } catch (error) {
    next(error);
  }
}

