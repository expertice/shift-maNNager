import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as permissionsService from '../services/permissionsService';
import { SchedulePermission } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/permissions
 * Получить список пользователей с доступом
 */
export async function getPermissions(
  req: AuthRequest,
  res: Response<ApiResponse<SchedulePermission[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const permissions = await permissionsService.getSchedulePermissions(scheduleId);

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/permissions
 * Добавить пользователя с доступом
 */
export async function createPermission(
  req: AuthRequest,
  res: Response<ApiResponse<SchedulePermission>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'userId and role are required',
      };
      return next(error);
    }

    const permission = await permissionsService.createSchedulePermission({
      scheduleId,
      userId,
      role,
    });

    res.status(201).json({
      success: true,
      data: permission,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/permissions/:id
 * Изменить роль пользователя
 */
export async function updatePermission(
  req: AuthRequest,
  res: Response<ApiResponse<SchedulePermission>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const { role } = req.body;

    if (!role) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'role is required',
      };
      return next(error);
    }

    const permission = await permissionsService.updateSchedulePermission(
      id,
      scheduleId,
      role
    );

    if (!permission) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Permission not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: permission,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/permissions/:id
 * Удалить доступ пользователя
 */
export async function deletePermission(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const deleted = await permissionsService.deleteSchedulePermission(id, scheduleId);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Permission not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

