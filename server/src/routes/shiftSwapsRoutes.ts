import { Router } from 'express';
import * as shiftSwapController from '../controllers/shiftSwapController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true });

/**
 * Все маршруты требуют аутентификации и доступа к схеме
 */
router.use(authenticate);
router.use(authorize('viewer'));

/**
 * POST /api/v1/schedules/:scheduleId/shift-swaps
 * Создать запрос на обмен (любой пользователь с доступом)
 */
router.post('/', shiftSwapController.createSwapRequest);

/**
 * GET /api/v1/schedules/:scheduleId/shift-swaps
 * Получить все запросы на обмен
 */
router.get('/', shiftSwapController.getSwapRequests);

/**
 * POST /api/v1/schedules/:scheduleId/shift-swaps/:id/approve
 * Подтвердить запрос на обмен (только editor/owner)
 */
router.post('/:id/approve', authorize('editor'), shiftSwapController.approveSwapRequest);

/**
 * POST /api/v1/schedules/:scheduleId/shift-swaps/:id/reject
 * Отклонить запрос на обмен (только editor/owner)
 */
router.post('/:id/reject', authorize('editor'), shiftSwapController.rejectSwapRequest);

export default router;

