import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, PaginatedResponse } from '../types';
import * as historyService from '../services/historyService';
import { ChangeHistory } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/history
 * Получить историю изменений
 */
export async function getHistory(
  req: AuthRequest,
  res: Response<ApiResponse<PaginatedResponse<ChangeHistory>>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await historyService.getScheduleHistory(scheduleId, limit, offset);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

