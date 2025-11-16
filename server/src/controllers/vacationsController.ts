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
  } catch (error: any) {
    console.error('Error in getVacations:', error);
    console.error('Error stack:', error?.stack);
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

    console.log('createVacation request:', { employeeId, startDate, endDate, status });

    if (!employeeId || !startDate || !endDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeId, startDate, and endDate are required',
      };
      return next(error);
    }

    // Преобразуем даты в объекты Date, обрезая время до начала дня в локальном времени
    // Используем parseISO или создаем дату напрямую из строки формата YYYY-MM-DD
    const startParts = startDate.split('-');
    const endParts = endDate.split('-');
    const start = new Date(Date.UTC(
      parseInt(startParts[0], 10),
      parseInt(startParts[1], 10) - 1,
      parseInt(startParts[2], 10)
    ));
    const end = new Date(Date.UTC(
      parseInt(endParts[0], 10),
      parseInt(endParts[1], 10) - 1,
      parseInt(endParts[2], 10)
    ));

    console.log('Parsed dates:', { start, end, startISO: start.toISOString(), endISO: end.toISOString() });

    const vacation = await vacationsService.createVacation({
      employeeId,
      startDate: start,
      endDate: end,
      status: status || 'approved',
      createdBy: req.user?.id || 'system',
    });

    // Извлекаем предупреждение, если оно есть
    const warning = (vacation as any).warning;
    const vacationData = { ...vacation };
    delete (vacationData as any).warning;

    res.status(201).json({
      success: true,
      data: vacationData,
      ...(warning && { warning }),
    });
  } catch (error: any) {
    console.error('Error in createVacation:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
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
      const startParts = updateData.startDate.toString().split('-');
      updateData.startDate = new Date(Date.UTC(
        parseInt(startParts[0], 10),
        parseInt(startParts[1], 10) - 1,
        parseInt(startParts[2], 10)
      ));
    }
    if (updateData.endDate) {
      const endParts = updateData.endDate.toString().split('-');
      updateData.endDate = new Date(Date.UTC(
        parseInt(endParts[0], 10),
        parseInt(endParts[1], 10) - 1,
        parseInt(endParts[2], 10)
      ));
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

    // Извлекаем предупреждение, если оно есть
    const warning = (vacation as any).warning;
    const vacationData = { ...vacation };
    delete (vacationData as any).warning;

    res.json({
      success: true,
      data: vacationData,
      ...(warning && { warning }),
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

