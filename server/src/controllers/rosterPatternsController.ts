import { Response, NextFunction } from 'express';
import { AuthRequest, ApiResponse, ApiError } from '../types';
import * as service from '../services/rosterPatternsService';
import { RosterPatternInstance } from '@prisma/client';

/**
 * GET /api/v1/schedules/:scheduleId/pattern-instances
 */
export async function getInstances(
  req: AuthRequest,
  res: Response<ApiResponse<RosterPatternInstance[]>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const items = await service.getInstancesForSchedule(scheduleId);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/schedules/:scheduleId/pattern-instances/:employeeId/sequence
 */
export async function patchSequence(
  req: AuthRequest,
  res: Response<ApiResponse<RosterPatternInstance>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId } = req.params;
    const { sequence } = req.body as { sequence: (string | null)[] };
    if (!Array.isArray(sequence)) {
      const err: ApiError = { status: 400, code: 'VALIDATION_ERROR', message: 'sequence must be array' };
      return next(err);
    }
    const updated = await service.updateSequence(scheduleId, employeeId, sequence);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/schedules/:scheduleId/pattern-instances/:employeeId/start-index
 */
export async function patchStartIndex(
  req: AuthRequest,
  res: Response<ApiResponse<RosterPatternInstance>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId } = req.params;
    const { startIndex } = req.body as { startIndex: number };
    if (typeof startIndex !== 'number' || startIndex < 0) {
      const err: ApiError = { status: 400, code: 'VALIDATION_ERROR', message: 'startIndex must be >= 0' };
      return next(err);
    }
    const updated = await service.updateStartIndex(scheduleId, employeeId, startIndex);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/pattern-instances/:employeeId/lock
 */
export async function lock(
  req: AuthRequest,
  res: Response<ApiResponse<RosterPatternInstance>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId } = req.params;
    const { indices } = req.body as { indices: number[] };
    if (!Array.isArray(indices)) {
      const err: ApiError = { status: 400, code: 'VALIDATION_ERROR', message: 'indices must be array' };
      return next(err);
    }
    const updated = await service.lockIndices(scheduleId, employeeId, indices);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/pattern-instances/:employeeId/unlock
 */
export async function unlock(
  req: AuthRequest,
  res: Response<ApiResponse<RosterPatternInstance>>,
  next: NextFunction
): Promise<void> {
  try {
    const { scheduleId, employeeId } = req.params;
    const { indices } = req.body as { indices: number[] };
    if (!Array.isArray(indices)) {
      const err: ApiError = { status: 400, code: 'VALIDATION_ERROR', message: 'indices must be array' };
      return next(err);
    }
    const updated = await service.unlockIndices(scheduleId, employeeId, indices);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}


