import { Router } from 'express';
import * as employeesController from '../controllers/employeesController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true }); // mergeParams для получения scheduleId из родительского роутера

/**
 * Все маршруты требуют аутентификации и доступа к схеме
 */
router.use(authenticate);
router.use(authorize('viewer'));

/**
 * GET /api/v1/schedules/:scheduleId/employees
 * Получить список сотрудников
 */
router.get('/', employeesController.getEmployees);

/**
 * POST /api/v1/schedules/:scheduleId/employees
 * Добавить сотрудника (только editor/owner)
 */
router.post('/', authorize('editor'), employeesController.createEmployee);

/**
 * PUT /api/v1/schedules/:scheduleId/employees/:id
 * Обновить сотрудника (только editor/owner)
 */
router.put('/:id', authorize('editor'), employeesController.updateEmployee);

/**
 * DELETE /api/v1/schedules/:scheduleId/employees/:id
 * Удалить сотрудника (только editor/owner)
 */
router.delete('/:id', authorize('editor'), employeesController.deleteEmployee);

/**
 * POST /api/v1/schedules/:scheduleId/employees/:id/generate-password
 * Сгенерировать одноразовый пароль (только editor/owner)
 */
router.post(
  '/:id/generate-password',
  authorize('editor'),
  employeesController.generatePassword
);

/**
 * POST /api/v1/schedules/:scheduleId/employees/bulk-placeholders
 * Создать болванчиков-сотрудников (только editor/owner)
 */
router.post(
  '/bulk-placeholders',
  authorize('editor'),
  employeesController.createPlaceholders
);

export default router;

