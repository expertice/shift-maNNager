import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse } from '../types';
import * as analyticsService from '../services/analyticsService';

/**
 * GET /api/v1/schedules/:scheduleId/analytics
 * Получить аналитику расписания
 */
export async function getAnalytics(
  req: AuthRequest,
  res: Response<ApiResponse<unknown>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const analytics = await analyticsService.calculateScheduleAnalytics(scheduleId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
}

