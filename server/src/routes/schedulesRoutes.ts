import { Router } from 'express';
import * as schedulesController from '../controllers/schedulesController';
import * as analyticsController from '../controllers/analyticsController';
import * as conflictsController from '../controllers/conflictsController';
import * as historyController from '../controllers/historyController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import employeesRoutes from './employeesRoutes';
import shiftsRoutes from './shiftsRoutes';
import vacationsRoutes from './vacationsRoutes';
import permissionsRoutes from './permissionsRoutes';
import rosterPatternsRoutes from './rosterPatternsRoutes';
import shiftSwapsRoutes from './shiftSwapsRoutes';

const router = Router();

/**
 * Все маршруты требуют аутентификации
 */
router.use(authenticate);

/**
 * GET /api/v1/schedules
 * Получить список всех схем
 */
router.get('/', schedulesController.getSchedules);

/**
 * GET /api/v1/schedules/:id
 * Получить схему по ID
 */
router.get('/:id', authorize('viewer'), schedulesController.getScheduleById);

/**
 * POST /api/v1/schedules
 * Создать новое расписание
 */
router.post('/', schedulesController.createSchedule);

/**
 * PUT /api/v1/schedules/:id
 * Обновить расписание
 */
router.put('/:id', authorize('editor'), schedulesController.updateSchedule);

/**
 * DELETE /api/v1/schedules/:id
 * Удалить расписание (только владелец)
 */
router.delete('/:id', authorize('owner'), schedulesController.deleteSchedule);

/**
 * POST /api/v1/schedules/:id/duplicate
 * Создать копию расписания
 */
router.post('/:id/duplicate', authorize('viewer'), schedulesController.duplicateSchedule);

/**
 * Employees routes
 * Все маршруты сотрудников требуют scheduleId
 */
router.use('/:scheduleId/employees', employeesRoutes);

/**
 * Shifts routes
 * Все маршруты смен требуют scheduleId
 */
router.use('/:scheduleId/shifts', shiftsRoutes);

/**
 * Vacations routes
 * Все маршруты отпусков требуют scheduleId
 */
router.use('/:scheduleId/vacations', vacationsRoutes);

// Roster pattern instances routes
router.use('/:scheduleId/pattern-instances', rosterPatternsRoutes);

/**
 * GET /api/v1/schedules/:scheduleId/analytics
 * Получить аналитику расписания
 */
router.get('/:scheduleId/analytics', authorize('viewer'), analyticsController.getAnalytics);

/**
 * GET /api/v1/schedules/:scheduleId/conflicts
 * Получить конфликты схемы
 */
router.get('/:scheduleId/conflicts', authorize('viewer'), conflictsController.getConflicts);

/**
 * POST /api/v1/schedules/:scheduleId/conflicts/:id/resolve
 * Разрешить конфликт
 */
router.post(
  '/:scheduleId/conflicts/:id/resolve',
  authorize('editor'),
  conflictsController.resolveConflict
);

/**
 * GET /api/v1/schedules/:scheduleId/history
 * Получить историю изменений
 */
router.get('/:scheduleId/history', authorize('viewer'), historyController.getHistory);

/**
 * Permissions routes
 * Все маршруты управления правами требуют scheduleId
 */
router.use('/:scheduleId/permissions', permissionsRoutes);

/**
 * Shift swap requests routes
 * Все маршруты запросов на обмен сменами требуют scheduleId
 */
router.use('/:scheduleId/shift-swaps', shiftSwapsRoutes);

export default router;


