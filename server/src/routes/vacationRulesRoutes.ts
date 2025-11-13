import { Router } from 'express';
import * as vacationRulesController from '../controllers/vacationRulesController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true });

/**
 * Все маршруты требуют аутентификации
 * Просмотр доступен viewer, редактирование - editor/owner
 */
router.use(authenticate);

/**
 * GET /api/v1/schedules/:scheduleId/vacation-rules
 * Получить правила отпусков
 */
router.get('/', authorize('viewer'), vacationRulesController.getVacationRules);

/**
 * PUT /api/v1/schedules/:scheduleId/vacation-rules
 * Обновить правила отпусков (только editor/owner)
 */
router.put('/', authorize('editor'), vacationRulesController.updateVacationRules);

/**
 * GET /api/v1/schedules/:scheduleId/vacation-allocations
 * Получить все выделения дней отпуска
 */
router.get('/allocations', authorize('viewer'), vacationRulesController.getEmployeeAllocations);

/**
 * PUT /api/v1/schedules/:scheduleId/vacation-allocations
 * Обновить выделения дней отпуска (bulk) (только editor/owner)
 */
router.put('/allocations', authorize('editor'), vacationRulesController.updateEmployeeAllocations);

/**
 * GET /api/v1/schedules/:scheduleId/vacation-allocations/:employeeId/:year
 * Получить выделение дней отпуска для конкретного сотрудника
 */
router.get(
  '/allocations/:employeeId/:year',
  authorize('viewer'),
  vacationRulesController.getEmployeeAllocation
);

export default router;

