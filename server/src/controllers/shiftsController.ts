import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as shiftsService from '../services/shiftsService';
import { DailyShift } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/shifts
 * Получить смены для схемы
 */
export async function getShifts(
  req: AuthRequest,
  res: Response<ApiResponse<DailyShift[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { startDate, endDate, employeeId } = req.query;

    const startDateObj = startDate ? new Date(startDate as string) : undefined;
    const endDateObj = endDate ? new Date(endDate as string) : undefined;

    const shifts = await shiftsService.getShiftsBySchedule(
      scheduleId,
      startDateObj,
      endDateObj,
      employeeId as string | undefined
    );

    res.json({
      success: true,
      data: shifts,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/shifts
 * Создать новую смену
 */
export async function createShift(
  req: AuthRequest,
  res: Response<ApiResponse<DailyShift>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeId, date, shiftTypeId } = req.body;

    if (!employeeId || !date) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeId and date are required',
      };
      return next(error);
    }
    
    // shiftTypeId может быть null для выходного дня
    if (shiftTypeId === undefined) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'shiftTypeId must be provided (can be null for day off)',
      };
      return next(error);
    }

    // Используем upsert для избежания ошибок дублирования
    // Нормализуем дату перед передачей
    const dateObj = new Date(date);
    const normalizedDate = new Date(Date.UTC(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      0, 0, 0, 0
    ));

    const shift = await shiftsService.upsertShift({
      scheduleId,
      employeeId,
      date: normalizedDate,
      shiftTypeId,
      status: 'modified', // При ручном назначении всегда 'modified'
    });

    res.status(201).json({
      success: true,
      data: shift,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/shifts/:id
 * Обновить смену
 */
export async function updateShift(
  req: AuthRequest,
  res: Response<ApiResponse<DailyShift>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const updateData = req.body;

    const shift = await shiftsService.updateShift(id, scheduleId, updateData);

    if (!shift) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Shift not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: shift,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/shifts/bulk
 * Массовое создание смен (при генерации)
 */
export async function bulkCreateShifts(
  req: AuthRequest,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { shifts } = req.body;

    if (!Array.isArray(shifts) || shifts.length === 0) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'shifts array is required',
      };
      return next(error);
    }

    const count = await shiftsService.bulkCreateShifts(
      scheduleId,
      shifts.map((s: any) => ({
        employeeId: s.employeeId,
        date: new Date(s.date),
        shiftTypeId: s.shiftTypeId,
      }))
    );

    res.status(201).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/shifts/swap
 * Обменять две смены
 */
export async function swapShifts(
  req: AuthRequest,
  res: Response<ApiResponse<{ shift1: DailyShift; shift2: DailyShift }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { shift1Id, shift2Id } = req.body;

    if (!shift1Id || !shift2Id) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'shift1Id and shift2Id are required',
      };
      return next(error);
    }

    const result = await shiftsService.swapShifts(shift1Id, shift2Id, scheduleId);

    if (!result) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'One or both shifts not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/shifts/:id
 * Удалить смену
 */
export async function deleteShift(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const deleted = await shiftsService.deleteShift(id, scheduleId);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Shift not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/shifts/employee/:employeeId
 * Удалить все смены сотрудника в периоде расписания
 */
export async function deleteEmployeeShifts(
  req: AuthRequest,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'startDate and endDate query parameters are required',
      };
      return next(error);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid date format',
      };
      return next(error);
    }

    const count = await shiftsService.deleteEmployeeShifts(scheduleId, employeeId, start, end);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

