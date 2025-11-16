import { Request, Response } from 'express';
import * as rosterSnapshotService from '../services/rosterSnapshotService';
import { logger } from '../utils/logger';

/**
 * GET /api/v1/schedules/:scheduleId/roster-snapshot
 * Получить снимок ростера
 */
export async function getRosterSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId } = req.params;

    const snapshot = await rosterSnapshotService.getRosterSnapshot(scheduleId);

    if (!snapshot) {
      res.status(404).json({ error: 'Roster snapshot not found' });
      return;
    }

    res.json(snapshot);
  } catch (error) {
    logger.error('Error getting roster snapshot:', error);
    res.status(500).json({ error: 'Failed to get roster snapshot' });
  }
}

/**
 * POST /api/v1/schedules/:scheduleId/roster-snapshot/sync
 * Синхронизировать снимок ростера с текущими данными
 */
export async function syncRosterSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId } = req.params;

    const snapshot = await rosterSnapshotService.syncRosterSnapshot(scheduleId);

    res.json(snapshot);
  } catch (error) {
    logger.error('Error syncing roster snapshot:', error);
    res.status(500).json({ error: 'Failed to sync roster snapshot' });
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/roster-snapshot
 * Обновить снимок ростера
 */
export async function updateRosterSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const data = req.body;

    const snapshot = await rosterSnapshotService.updateRosterSnapshot(scheduleId, data);

    res.json(snapshot);
  } catch (error) {
    logger.error('Error updating roster snapshot:', error);
    res.status(500).json({ error: 'Failed to update roster snapshot' });
  }
}

/**
 * PUT /api/v1/schedules/:scheduleId/roster-snapshot/employee-order
 * Обновить порядок сотрудников в снимке ростера
 */
export async function updateEmployeeOrder(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId } = req.params;
    const { employeeOrder } = req.body;

    if (!Array.isArray(employeeOrder)) {
      res.status(400).json({ error: 'employeeOrder must be an array' });
      return;
    }

    const snapshot = await rosterSnapshotService.updateEmployeeOrder(scheduleId, employeeOrder);

    res.json(snapshot);
  } catch (error) {
    logger.error('Error updating employee order:', error);
    res.status(500).json({ error: 'Failed to update employee order' });
  }
}

