import { Router } from 'express';
import * as shiftsController from '../controllers/shiftsController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true });

/**
 * Все маршруты требуют аутентификации и доступа к схеме
 */
router.use(authenticate);
router.use(authorize('viewer'));

/**
 * GET /api/v1/schedules/:scheduleId/shifts
 * Получить смены
 */
router.get('/', shiftsController.getShifts);

/**
 * POST /api/v1/schedules/:scheduleId/shifts
 * Создать смену (только editor/owner)
 */
router.post('/', authorize('editor'), shiftsController.createShift);

/**
 * POST /api/v1/schedules/:scheduleId/shifts/bulk
 * Массовое создание смен (только editor/owner)
 */
router.post('/bulk', authorize('editor'), shiftsController.bulkCreateShifts);

/**
 * POST /api/v1/schedules/:scheduleId/shifts/swap
 * Обменять две смены (только editor/owner)
 */
router.post('/swap', authorize('editor'), shiftsController.swapShifts);

/**
 * DELETE /api/v1/schedules/:scheduleId/shifts/employee/:employeeId
 * Удалить все смены сотрудника в периоде расписания (только editor/owner)
 * Должен быть перед /:id, чтобы избежать конфликта маршрутов
 */
router.delete('/employee/:employeeId', authorize('editor'), shiftsController.deleteEmployeeShifts);

/**
 * PUT /api/v1/schedules/:scheduleId/shifts/:id
 * Обновить смену (только editor/owner)
 */
router.put('/:id', authorize('editor'), shiftsController.updateShift);

/**
 * DELETE /api/v1/schedules/:scheduleId/shifts/:id
 * Удалить смену (только editor/owner)
 */
router.delete('/:id', authorize('editor'), shiftsController.deleteShift);

export default router;

