import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError, CompareProfilesResponse } from '../types';
import * as shiftProfilesService from '../services/shiftProfilesService';
import { ShiftProfile } from '@prisma/client';
import { parseISO } from 'date-fns';

/**
 * GET /api/v1/shift-profiles?scheduleId=xxx
 * Получить все профили смен для конкретного расписания
 */
export async function getShiftProfiles(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftProfile[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.query;

    if (!scheduleId || typeof scheduleId !== 'string') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId query parameter is required',
      };
      return next(error);
    }

    const profiles = await shiftProfilesService.getShiftProfilesBySchedule(scheduleId);

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/shift-profiles/:id?scheduleId=xxx
 * Получить профиль смены с деталями
 */
export async function getShiftProfileById(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftProfile>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { scheduleId } = req.query;

    // scheduleId опциональный - если указан, проверяем принадлежность
    const profile = await shiftProfilesService.getShiftProfileById(
      id,
      scheduleId as string | undefined
    );

    if (!profile) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Shift profile not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/shift-profiles
 * Создать новый профиль смены
 */
export async function createShiftProfile(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftProfile>>,
  next: NextFunction
): Promise<void> {
  try {
    const createData = req.body;

    // Валидация основных полей
    if (!createData.scheduleId) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId is required',
      };
      return next(error);
    }

    if (!createData.name) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Profile name is required',
      };
      return next(error);
    }

    if (!createData.shiftTypes || !Array.isArray(createData.shiftTypes)) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'shiftTypes array is required',
      };
      return next(error);
    }

    if (!createData.patterns || !Array.isArray(createData.patterns)) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'patterns array is required',
      };
      return next(error);
    }

    const newProfile = await shiftProfilesService.createShiftProfile(createData);

    if (!newProfile) {
      const error: ApiError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to create profile',
      };
      return next(error);
    }

    res.status(201).json({
      success: true,
      data: newProfile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/shift-profiles/:id
 * Обновить профиль смены
 */
export async function updateShiftProfile(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftProfile>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Валидация основных полей
    if (!updateData.scheduleId) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId is required',
      };
      return next(error);
    }

    if (!updateData.name) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Profile name is required',
      };
      return next(error);
    }

    if (!updateData.shiftTypes || !Array.isArray(updateData.shiftTypes)) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'shiftTypes array is required',
      };
      return next(error);
    }

    if (!updateData.patterns || !Array.isArray(updateData.patterns)) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'patterns array is required',
      };
      return next(error);
    }

    const updatedProfile = await shiftProfilesService.updateShiftProfile(id, updateData);

    if (!updatedProfile) {
      const error: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Shift profile not found',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/generate-shifts
 * Сгенерировать смены на основе профиля смены
 */
export async function generateShifts(
  req: AuthRequest,
  res: Response<ApiResponse<{ count: number; shifts: unknown[] }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { shiftProfileId, employeeIds, startDate, endDate } = req.body;

    if (!shiftProfileId || !employeeIds || !Array.isArray(employeeIds) || !startDate || !endDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'shiftProfileId, employeeIds array, startDate, and endDate are required',
      };
      return next(error);
    }

    // Диагностика: логируем входные параметры
    try {
      // eslint-disable-next-line no-console
      console.info('[controller][generateShifts] request', {
        scheduleId,
        shiftProfileId,
        employees: Array.isArray(employeeIds) ? employeeIds.length : 0,
        startDate,
        endDate,
      });
    } catch {}

    const result = await shiftProfilesService.generateShiftsFromProfile({
      scheduleId,
      shiftProfileId,
      employeeIds,
      startDate: parseISO(startDate),
      endDate: parseISO(endDate),
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/shift-profiles/compare
 * Сравнить несколько профилей смен
 */
export async function compareProfilesHandler(
  req: AuthRequest,
  res: Response<ApiResponse<CompareProfilesResponse>>,
  next: NextFunction
): Promise<void> {
  try {
    const { profileIds, startDate, endDate, employeeCount } = req.body;

    // Валидация входных данных
    if (!profileIds || !Array.isArray(profileIds) || profileIds.length < 2) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Необходимо выбрать минимум 2 профиля для сравнения',
      };
      return next(error);
    }

    if (!startDate || !endDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Необходимо указать период сравнения (startDate и endDate)',
      };
      return next(error);
    }

    let requestedEmployeeCount: number | undefined;
    if (employeeCount !== undefined) {
      const parsedEmployeeCount = Number(employeeCount);
      if (!Number.isFinite(parsedEmployeeCount) || parsedEmployeeCount < 1) {
        const error: ApiError = {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Количество сотрудников должно быть положительным числом',
        };
        return next(error);
      }
      requestedEmployeeCount = Math.floor(parsedEmployeeCount);
    }

    // Парсим даты
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Проверяем корректность дат
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Некорректный формат даты',
      };
      return next(error);
    }

    if (end <= start) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Конечная дата должна быть позже начальной',
      };
      return next(error);
    }

    // Вызываем сервис сравнения
    const comparisonResult = await shiftProfilesService.compareProfiles(
      profileIds,
      start,
      end,
      requestedEmployeeCount
    );

    res.json({
      success: true,
      data: comparisonResult,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/shift-profiles/:id
 * Удалить профиль смены
 */
export async function deleteShiftProfileHandler(
  req: AuthRequest,
  res: Response<ApiResponse<{ message: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { scheduleId } = req.query;

    if (!scheduleId || typeof scheduleId !== 'string') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId query parameter is required',
      };
      return next(error);
    }

    await shiftProfilesService.deleteShiftProfile(id, scheduleId);

    res.json({
      success: true,
      data: { message: 'Профиль успешно удален' },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/shift-profiles/:id/clone
 * Клонировать профиль смены
 */
export async function cloneShiftProfileHandler(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftProfile>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const clonedProfile = await shiftProfilesService.cloneShiftProfile(id);

    res.status(201).json({
      success: true,
      data: clonedProfile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/shift-profiles/update-pattern-offset
 * Обновить смещение паттерна для всех экземпляров в расписании
 */
export async function updatePatternOffsetHandler(
  req: AuthRequest,
  res: Response<ApiResponse<{ message: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, offsetDelta } = req.body;

    if (!scheduleId || typeof scheduleId !== 'string') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId is required',
      };
      return next(error);
    }

    if (offsetDelta === undefined || typeof offsetDelta !== 'number') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'offsetDelta is required and must be a number',
      };
      return next(error);
    }

    await shiftProfilesService.updatePatternOffset(scheduleId, offsetDelta);

    res.json({
      success: true,
      data: { message: 'Pattern offset updated successfully' },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/shift-profiles/update-employee-pattern-offset
 * Обновить смещение паттерна для конкретного сотрудника
 */
export async function updateEmployeePatternOffsetHandler(
  req: AuthRequest,
  res: Response<ApiResponse<{ message: string }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId, offsetDelta } = req.body;

    if (!scheduleId || typeof scheduleId !== 'string') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId is required',
      };
      return next(error);
    }

    if (!employeeId || typeof employeeId !== 'string') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'employeeId is required',
      };
      return next(error);
    }

    if (offsetDelta === undefined || typeof offsetDelta !== 'number') {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'offsetDelta is required and must be a number',
      };
      return next(error);
    }

    await shiftProfilesService.updateEmployeePatternOffset(scheduleId, employeeId, offsetDelta);

    res.json({
      success: true,
      data: { message: 'Employee pattern offset updated successfully' },
    });
  } catch (error) {
    next(error);
  }
}

