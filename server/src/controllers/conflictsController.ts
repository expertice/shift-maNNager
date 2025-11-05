import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as conflictsService from '../services/conflictsService';
import { Conflict } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/conflicts
 * Получить конфликты схемы
 */
export async function getConflicts(
  req: AuthRequest,
  res: Response<ApiResponse<Conflict[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { resolved } = req.query;

    const conflicts = await conflictsService.getConflictsBySchedule(
      scheduleId,
      resolved === 'true' ? true : resolved === 'false' ? false : undefined
    );

    res.json({
      success: true,
      data: conflicts,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/conflicts/:id/resolve
 * Разрешить конфликт
 */
export async function resolveConflict(
  req: AuthRequest,
  res: Response<ApiResponse<Conflict>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const { solutionId, resolutionNotes } = req.body;

    const conflict = await conflictsService.resolveConflict(
      id,
      scheduleId,
      solutionId,
      resolutionNotes
    );

    if (!conflict) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Conflict not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: conflict,
    });
  } catch (error) {
    next(error);
  }
}

