import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as vacationsService from '../services/vacationsService';
import { Vacation } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/vacations
 * Получить отпуска для схемы
 */
export async function getVacations(
  req: AuthRequest,
  res: Response<ApiResponse<Vacation[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeId, status } = req.query;

    const vacations = await vacationsService.getVacationsBySchedule(
      scheduleId,
      employeeId as string | undefined,
      status as string | undefined
    );

    res.json({
      success: true,
      data: vacations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/vacations
 * Добавить отпуск
 */
export async function createVacation(
  req: AuthRequest,
  res: Response<ApiResponse<Vacation>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId: _scheduleId } = req.params; // Используется в authorize middleware
    const { employeeId, startDate, endDate, status } = req.body;

    if (!employeeId || !startDate || !endDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeId, startDate, and endDate are required',
      };
      return next(error);
    }

    const vacation = await vacationsService.createVacation({
      employeeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status || 'approved',
      createdBy: req.user?.id || 'system',
    });

    res.status(201).json({
      success: true,
      data: vacation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/vacations/:id
 * Обновить отпуск
 */
export async function updateVacation(
  req: AuthRequest,
  res: Response<ApiResponse<Vacation>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const updateData = req.body;

    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const vacation = await vacationsService.updateVacation(id, scheduleId, updateData);

    if (!vacation) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Vacation not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: vacation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/vacations/:id
 * Удалить отпуск
 */
export async function deleteVacation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const deleted = await vacationsService.deleteVacation(id, scheduleId);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Vacation not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

