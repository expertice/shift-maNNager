import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as positionsService from '../services/positionsService';
import { Position } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/positions
 * Получить список должностей схемы
 */
export async function getPositions(
  req: AuthRequest,
  res: Response<ApiResponse<Position[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const positions = await positionsService.getPositionsBySchedule(scheduleId);

    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/positions
 * Добавить должность
 */
export async function createPosition(
  req: AuthRequest,
  res: Response<ApiResponse<Position>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { name } = req.body;

    // Логирование для диагностики
    console.log('[createPosition] Request:', { scheduleId, name, body: req.body });

    if (!name || typeof name !== 'string' || !name.trim()) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'name is required and must be a non-empty string',
      };
      return next(error);
    }

    const position = await positionsService.createPosition({
      scheduleId,
      name,
    });

    res.status(201).json({
      success: true,
      data: position,
    });
  } catch (error) {
    // Обработка ошибок из сервиса
    if (error instanceof Error) {
      const apiError: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: error.message,
      };
      return next(apiError);
    }
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/positions/:id
 * Обновить должность
 */
export async function updatePosition(
  req: AuthRequest,
  res: Response<ApiResponse<Position>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const updateData = req.body;

    const position = await positionsService.updatePosition(id, scheduleId, updateData);

    if (!position) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Position not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/positions/:id
 * Удалить должность из схемы
 */
export async function deletePosition(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const deleted = await positionsService.deletePosition(id, scheduleId);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Position not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

