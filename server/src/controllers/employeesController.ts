import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as employeesService from '../services/employeesService';
import * as importExportService from '../services/importExportService';
import { Employee } from '@prisma/client';
import { generateTemporaryPassword } from '../services/passwordService';
import multer from 'multer';

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
    const { fullName, tabNumber, positionId, birthDate, departmentId, isHidden } = req.body;

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
      positionId,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      isHidden: isHidden || false,
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

/**
 * POST /api/v1/schedules/:scheduleId/employees/:id/clone
 * Клонировать сотрудника
 */
export async function cloneEmployee(
  req: AuthRequest,
  res: Response<ApiResponse<Employee>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const clonedEmployee = await employeesService.cloneEmployee(id, scheduleId);

    if (!clonedEmployee) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Employee not found',
      };
      return next(error);
    }

    res.status(201).json({
      success: true,
      data: clonedEmployee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/employees/:id/assign-profile
 * Назначить профиль смены сотруднику
 */
export async function assignProfile(
  req: AuthRequest,
  res: Response<ApiResponse<Employee>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, id } = req.params;
    const { shiftProfileId } = req.body;

    const updatedEmployee = await employeesService.assignShiftProfile(
      id,
      scheduleId,
      shiftProfileId
    );

    if (!updatedEmployee) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Employee not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: updatedEmployee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/employees/bulk
 * Массовое обновление сотрудников
 */
export async function bulkUpdateEmployees(
  req: AuthRequest,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeIds, departmentId, positionId } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeIds array is required and must not be empty',
      };
      return next(error);
    }

    const count = await employeesService.bulkUpdateEmployees(employeeIds, scheduleId, {
      departmentId,
      positionId,
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/schedules/:scheduleId/employees/bulk
 * Массовое удаление сотрудников
 */
export async function bulkDeleteEmployees(
  req: AuthRequest,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeIds array is required and must not be empty',
      };
      return next(error);
    }

    const count = await employeesService.bulkDeleteEmployees(employeeIds, scheduleId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

// Настройка multer для загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Поддерживаются только файлы CSV и Excel (.xlsx)'));
    }
  },
});

/**
 * Middleware для загрузки файла
 */
export const uploadFile = upload.single('file');

/**
 * GET /api/v1/schedules/:scheduleId/employees/export
 * Экспорт сотрудников
 */
export async function exportEmployees(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const format = (req.query.format as 'csv' | 'xlsx') || 'csv';

    if (format !== 'csv' && format !== 'xlsx') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'format must be csv or xlsx',
      };
      return next(error);
    }

    // Получаем всех сотрудников с отделами и должностями
    const { prisma } = await import('../lib/prisma');
    const employees = await prisma.employee.findMany({
      where: { scheduleId },
      include: {
        department: true,
        position: true,
      },
    });

    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === 'csv') {
      buffer = importExportService.generateCSV(employees);
      contentType = 'text/csv';
      filename = `employees_${scheduleId}_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      buffer = importExportService.generateExcel(employees);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `employees_${scheduleId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/employees/import
 * Импорт сотрудников
 */
export async function importEmployees(
  req: AuthRequest,
  res: Response<ApiResponse<importExportService.ImportResult>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const file = req.file;
    const mode = (req.body.mode as importExportService.ImportMode) || 'mixed';

    if (!file) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'File is required',
      };
      return next(error);
    }

    if (mode !== 'create' && mode !== 'update' && mode !== 'mixed') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'mode must be create, update, or mixed',
      };
      return next(error);
    }

    // Парсим файл
    let rows: importExportService.ImportRow[];
    if (file.originalname.endsWith('.csv') || file.mimetype === 'text/csv') {
      rows = importExportService.parseCSVFile(file.buffer);
    } else {
      rows = importExportService.parseExcelFile(file.buffer);
    }

    // Валидация данных
    const validationErrors = importExportService.validateImportData(rows, scheduleId);
    if (validationErrors.length > 0) {
      return res.json({
        success: true,
        data: {
          success: 0,
          errors: validationErrors,
        },
      });
    }

    // Обработка импорта
    const result = await importExportService.processImport(rows, scheduleId, mode);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/employees/bulk-visibility
 * Массовое обновление видимости сотрудников
 */
export async function bulkUpdateEmployeeVisibility(
  req: AuthRequest,
  res: Response<ApiResponse<{ count: number }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeIds, isHidden } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeIds array is required and must not be empty',
      };
      return next(error);
    }

    if (typeof isHidden !== 'boolean') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'isHidden must be a boolean',
      };
      return next(error);
    }

    const count = await employeesService.bulkUpdateEmployeeVisibility(employeeIds, scheduleId, isHidden);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

