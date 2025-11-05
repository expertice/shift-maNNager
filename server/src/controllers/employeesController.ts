import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as employeesService from '../services/employeesService';
import { Employee } from '@prisma/client';
import { generateTemporaryPassword } from '../services/passwordService';

/**
 * GET /api/v1/schedules/:scheduleId/employees
 * Получить список сотрудников схемы
 */
export async function getEmployees(
  req: AuthRequest,
  res: Response<ApiResponse<Employee[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const employees = await employeesService.getEmployeesBySchedule(scheduleId);

    res.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/employees
 * Добавить сотрудника
 */
export async function createEmployee(
  req: AuthRequest,
  res: Response<ApiResponse<Employee>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { fullName, tabNumber, birthDate, departmentId } = req.body;

    if (!fullName || !tabNumber || !departmentId) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'fullName, tabNumber, and departmentId are required',
      };
      return next(error);
    }

    const employee = await employeesService.createEmployee({
      scheduleId,
      departmentId,
      fullName,
      tabNumber,
      birthDate: birthDate ? new Date(birthDate) : undefined,
    });

    res.status(201).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/employees/:id
 * Обновить данные сотрудника
 */
export async function updateEmployee(
  req: AuthRequest,
  res: Response<ApiResponse<Employee>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const updateData = req.body;

    if (updateData.birthDate) {
      updateData.birthDate = new Date(updateData.birthDate);
    }

    const employee = await employeesService.updateEmployee(id, scheduleId, updateData);

    if (!employee) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Employee not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/employees/:id
 * Удалить сотрудника из схемы
 */
export async function deleteEmployee(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const deleted = await employeesService.deleteEmployee(id, scheduleId);

    if (!deleted) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Employee not found',
      };
      return next(error);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/employees/:id/generate-password
 * Сгенерировать одноразовый пароль
 */
export async function generatePassword(
  req: AuthRequest,
  res: Response<
    ApiResponse<{
      temporaryPassword: string;
      expiresAt: Date;
      loginId: string;
    }>
  >,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await generateTemporaryPassword(id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/employees/bulk-placeholders
 * Создать болванчиков-сотрудников
 */
export async function createPlaceholders(
  req: AuthRequest,
  res: Response<ApiResponse<Employee[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { count, departmentId } = req.body;

    if (!count || count <= 0) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'count is required and must be > 0',
      };
      return next(error);
    }

    const employees = await employeesService.createPlaceholders({
      scheduleId,
      departmentId,
      count,
    });

    res.status(201).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
}

