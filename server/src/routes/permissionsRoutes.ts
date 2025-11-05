import { Router } from 'express';
import * as permissionsController from '../controllers/permissionsController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true });

/**
 * Все маршруты требуют аутентификации и доступа к схеме
 */
router.use(authenticate);
router.use(authorize('owner')); // Только владелец может управлять правами

/**
 * GET /api/v1/schedules/:scheduleId/permissions
 * Получить список пользователей с доступом
 */
router.get('/', permissionsController.getPermissions);

/**
 * POST /api/v1/schedules/:scheduleId/permissions
 * Добавить пользователя с доступом
 */
router.post('/', permissionsController.createPermission);

/**
 * PUT /api/v1/schedules/:scheduleId/permissions/:id
 * Изменить роль пользователя
 */
router.put('/:id', permissionsController.updatePermission);

/**
 * DELETE /api/v1/schedules/:scheduleId/permissions/:id
 * Удалить доступ пользователя
 */
router.delete('/:id', permissionsController.deletePermission);

export default router;

