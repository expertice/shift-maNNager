import { Router } from 'express';
import * as vacationsController from '../controllers/vacationsController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true });

/**
 * Все маршруты требуют аутентификации и доступа к схеме
 */
router.use(authenticate);
router.use(authorize('viewer'));

/**
 * GET /api/v1/schedules/:scheduleId/vacations
 * Получить отпуска
 */
router.get('/', vacationsController.getVacations);

/**
 * POST /api/v1/schedules/:scheduleId/vacations
 * Добавить отпуск (только editor/owner, или сотрудник для себя)
 */
router.post('/', vacationsController.createVacation);

/**
 * PUT /api/v1/schedules/:scheduleId/vacations/:id
 * Обновить отпуск (только editor/owner, или сотрудник для себя)
 */
router.put('/:id', vacationsController.updateVacation);

/**
 * DELETE /api/v1/schedules/:scheduleId/vacations/:id
 * Удалить отпуск (только editor/owner, или сотрудник для себя)
 */
router.delete('/:id', vacationsController.deleteVacation);

export default router;

