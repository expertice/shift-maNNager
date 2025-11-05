import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Вход для суперпользователя
 */
router.post('/login', authController.loginUser);

/**
 * POST /api/v1/auth/employee/login
 * Вход для сотрудника
 */
router.post('/employee/login', authController.loginEmployee);

/**
 * POST /api/v1/auth/employee/:employeeId/generate-password
 * Генерация одноразового пароля для сотрудника
 * Требуется аутентификация и права editor/owner
 */
router.post(
  '/employee/:employeeId/generate-password',
  authenticate,
  authorize('editor'),
  authController.generateEmployeePassword
);

export default router;

