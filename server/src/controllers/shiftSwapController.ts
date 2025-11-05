import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as shiftSwapService from '../services/shiftSwapService';
import { ShiftSwapRequestWithDetails } from '../services/shiftSwapService';

/**
 * POST /api/v1/schedules/:scheduleId/shift-swaps
 * Создать запрос на обмен сменами
 */
export async function createSwapRequest(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftSwapRequestWithDetails>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { initiatorEmployeeId, fromEmployeeId, fromDate, toEmployeeId, toDate } = req.body;

    if (!initiatorEmployeeId || !fromEmployeeId || !fromDate || !toEmployeeId || !toDate) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'All fields are required: initiatorEmployeeId, fromEmployeeId, fromDate, toEmployeeId, toDate',
      };
      return next(error);
    }

    const request = await shiftSwapService.createSwapRequest({
      scheduleId,
      initiatorEmployeeId,
      fromEmployeeId,
      fromDate: new Date(fromDate),
      toEmployeeId,
      toDate: new Date(toDate),
    });

    // Получаем полную информацию о запросе
    const requests = await shiftSwapService.getSwapRequests(scheduleId);
    const requestWithDetails = requests.find((r) => r.id === request.id);

    if (!requestWithDetails) {
      const error: ApiError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve created request',
      };
      return next(error);
    }

    res.status(201).json({
      success: true,
      data: requestWithDetails,
    });
  } catch (error: any) {
    if (error.message) {
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
 * GET /api/v1/schedules/:scheduleId/shift-swaps
 * Получить все запросы на обмен для схемы
 */
export async function getSwapRequests(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftSwapRequestWithDetails[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { status } = req.query;

    const requests = await shiftSwapService.getSwapRequests(
      scheduleId,
      status as any
    );

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/shift-swaps/:id/approve
 * Подтвердить запрос на обмен
 */
export async function approveSwapRequest(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftSwapRequestWithDetails>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id, scheduleId } = req.params;

    if (!scheduleId) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId is required',
      };
      return next(error);
    }

    const request = await shiftSwapService.approveSwapRequest(id, scheduleId);

    // Получаем полную информацию о запросе
    const requests = await shiftSwapService.getSwapRequests(scheduleId);
    const requestWithDetails = requests.find((r) => r.id === request.id);

    if (!requestWithDetails) {
      const error: ApiError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve updated request',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: requestWithDetails,
    });
  } catch (error: any) {
    if (error.message) {
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
 * POST /api/v1/schedules/:scheduleId/shift-swaps/:id/reject
 * Отклонить запрос на обмен
 */
export async function rejectSwapRequest(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftSwapRequestWithDetails>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id, scheduleId } = req.params;

    if (!scheduleId) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId is required',
      };
      return next(error);
    }

    const request = await shiftSwapService.rejectSwapRequest(id, scheduleId);

    // Получаем полную информацию о запросе
    const requests = await shiftSwapService.getSwapRequests(scheduleId);
    const requestWithDetails = requests.find((r) => r.id === request.id);

    if (!requestWithDetails) {
      const error: ApiError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve updated request',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: requestWithDetails,
    });
  } catch (error: any) {
    if (error.message) {
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
 * DELETE /api/v1/shift-swaps/:id
 * Отменить запрос на обмен (инициатором)
 */
export async function cancelSwapRequest(
  req: AuthRequest,
  res: Response<ApiResponse<ShiftSwapRequestWithDetails>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { scheduleId, employeeId } = req.body;

    if (!scheduleId || !employeeId) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'scheduleId and employeeId are required',
      };
      return next(error);
    }

    const request = await shiftSwapService.cancelSwapRequest(id, scheduleId, employeeId);

    // Получаем полную информацию о запросе
    const requests = await shiftSwapService.getSwapRequests(scheduleId);
    const requestWithDetails = requests.find((r) => r.id === request.id);

    if (!requestWithDetails) {
      const error: ApiError = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve updated request',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: requestWithDetails,
    });
  } catch (error: any) {
    if (error.message) {
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

