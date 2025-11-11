import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as departmentsService from '../services/departmentsService';
import { Department } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/departments
 * Получить список отделов схемы
 */
export async function getDepartments(
  req: AuthRequest,
  res: Response<ApiResponse<Department[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const departments = await departmentsService.getDepartmentsBySchedule(scheduleId);

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/departments
 * Добавить отдел
 */
export async function createDepartment(
  req: AuthRequest,
  res: Response<ApiResponse<Department>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'name is required',
      };
      return next(error);
    }

    const department = await departmentsService.createDepartment({
      scheduleId,
      name,
    });

    res.status(201).json({
      success: true,
      data: department,
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
 * PUT /api/v1/schedules/:scheduleId/departments/:id
 * Обновить отдел
 */
export async function updateDepartment(
  req: AuthRequest,
  res: Response<ApiResponse<Department>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const updateData = req.body;

    const department = await departmentsService.updateDepartment(id, scheduleId, updateData);

    if (!department) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Department not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/departments/:id
 * Удалить отдел из схемы
 */
export async function deleteDepartment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const deleted = await departmentsService.deleteDepartment(id, scheduleId);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Department not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

