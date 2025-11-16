import { Router } from 'express';
import * as rosterSnapshotController from '../controllers/rosterSnapshotController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticate);

/**
 * GET /api/v1/schedules/:scheduleId/roster-snapshot
 * Получить снимок ростера
 */
router.get('/schedules/:scheduleId/roster-snapshot', rosterSnapshotController.getRosterSnapshot);

/**
 * POST /api/v1/schedules/:scheduleId/roster-snapshot/sync
 * Синхронизировать снимок ростера с текущими данными
 */
router.post('/schedules/:scheduleId/roster-snapshot/sync', rosterSnapshotController.syncRosterSnapshot);

/**
 * PUT /api/v1/schedules/:scheduleId/roster-snapshot
 * Обновить снимок ростера
 */
router.put('/schedules/:scheduleId/roster-snapshot', rosterSnapshotController.updateRosterSnapshot);

/**
 * PUT /api/v1/schedules/:scheduleId/roster-snapshot/employee-order
 * Обновить порядок сотрудников в снимке ростера
 */
router.put('/schedules/:scheduleId/roster-snapshot/employee-order', rosterSnapshotController.updateEmployeeOrder);

export default router;

