import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError, PaginatedResponse } from '../types';
import * as schedulesService from '../services/schedulesService';
import { Schedule, ScheduleStatus } from '@prisma/client';
import { ScheduleWithDetails } from '../services/schedulesService';

/**
 * GET /api/v1/schedules
 * Получить список всех схем, доступных текущему пользователю
 */
export async function getSchedules(
  req: AuthRequest,
  res: Response<ApiResponse<PaginatedResponse<Schedule>>>,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      const error: ApiError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      };
      return next(error);
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const status = req.query.status as string | undefined;

    const result = await schedulesService.getSchedulesForUser(
      user.id,
      page,
      pageSize,
      status
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
 * GET /api/v1/schedules/:id
 * Получить расписание со всеми деталями
 */
export async function getScheduleById(
  req: AuthRequest,
  res: Response<ApiResponse<ScheduleWithDetails>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const schedule = await schedulesService.getScheduleById(id, req.user?.id);

    if (!schedule) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Schedule not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules
 * Создать новое расписание
 */
export async function createSchedule(
  req: AuthRequest,
  res: Response<ApiResponse<Schedule>>,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      const error: ApiError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      };
      return next(error);
    }

    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Name, startDate, and endDate are required',
      };
      return next(error);
    }

    const schedule = await schedulesService.createSchedule({
      ownerUserId: user.id,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:id
 * Обновить расписание
 */
export async function updateSchedule(
  req: AuthRequest,
  res: Response<ApiResponse<Schedule>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status, reportingPeriod, patternStartOffset } = req.body;

    // Подготавливаем данные для обновления
    const updateData: schedulesService.UpdateScheduleData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      updateData.endDate = new Date(endDate);
    }

    if (status !== undefined) {
      updateData.status = status as ScheduleStatus;
    }

    if (reportingPeriod !== undefined) {
      updateData.reportingPeriod = reportingPeriod;
    }

    if (patternStartOffset !== undefined) {
      updateData.patternStartOffset = patternStartOffset;
    }

    const schedule = await schedulesService.updateSchedule(id, updateData, req.user?.id);

    if (!schedule) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Schedule not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:id
 * Удалить расписание
 */
export async function deleteSchedule(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await schedulesService.deleteSchedule(id, req.user?.id);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Schedule not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:id/duplicate
 * Создать копию расписания
 */
export async function duplicateSchedule(
  req: AuthRequest,
  res: Response<ApiResponse<Schedule>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'newName is required',
      };
      return next(error);
    }

    const schedule = await schedulesService.duplicateSchedule(id, newName, req.user?.id);

    if (!schedule) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Schedule not found',
      };
      return next(error);
    }

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
}

