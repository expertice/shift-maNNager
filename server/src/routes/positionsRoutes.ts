import { Router } from 'express';
import * as positionsController from '../controllers/positionsController';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true }); // mergeParams для получения scheduleId из родительского роутера

/**
 * GET /api/v1/schedules/:scheduleId/positions
 * Получить список должностей (требуется аутентификация)
 */
router.get('/', positionsController.getPositions);

/**
 * POST /api/v1/schedules/:scheduleId/positions
 * Добавить должность (только editor/owner)
 */
router.post('/', authorize('editor'), positionsController.createPosition);

/**
 * PUT /api/v1/schedules/:scheduleId/positions/:id
 * Обновить должность (только editor/owner)
 */
router.put('/:id', authorize('editor'), positionsController.updatePosition);

/**
 * DELETE /api/v1/schedules/:scheduleId/positions/:id
 * Удалить должность (только editor/owner)
 */
router.delete('/:id', authorize('editor'), positionsController.deletePosition);

export default router;

