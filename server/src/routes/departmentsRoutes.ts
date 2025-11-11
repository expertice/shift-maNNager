import { Router } from 'express';
import * as departmentsController from '../controllers/departmentsController';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true }); // mergeParams для получения scheduleId из родительского роутера

/**
 * GET /api/v1/schedules/:scheduleId/departments
 * Получить список отделов (требуется аутентификация)
 */
router.get('/', departmentsController.getDepartments);

/**
 * POST /api/v1/schedules/:scheduleId/departments
 * Добавить отдел (только editor/owner)
 */
router.post('/', authorize('editor'), departmentsController.createDepartment);

/**
 * PUT /api/v1/schedules/:scheduleId/departments/:id
 * Обновить отдел (только editor/owner)
 */
router.put('/:id', authorize('editor'), departmentsController.updateDepartment);

/**
 * DELETE /api/v1/schedules/:scheduleId/departments/:id
 * Удалить отдел (только editor/owner)
 */
router.delete('/:id', authorize('editor'), departmentsController.deleteDepartment);

export default router;

