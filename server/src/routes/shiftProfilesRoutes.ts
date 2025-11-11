import { Router } from 'express';
import * as shiftProfilesController from '../controllers/shiftProfilesController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/shift-profiles
 * Получить все профили смен (требуется аутентификация)
 */
router.get('/', authenticate, shiftProfilesController.getShiftProfiles);

/**
 * POST /api/v1/shift-profiles
 * Создать новый профиль смены (требуется аутентификация)
 */
router.post('/', authenticate, shiftProfilesController.createShiftProfile);

/**
 * POST /api/v1/shift-profiles/compare
 * Сравнить несколько профилей смен (требуется аутентификация)
 */
router.post('/compare', authenticate, shiftProfilesController.compareProfilesHandler);

/**
 * POST /api/v1/shift-profiles/update-pattern-offset
 * Обновить смещение паттерна для всех экземпляров в расписании (требуется аутентификация)
 */
router.post('/update-pattern-offset', authenticate, shiftProfilesController.updatePatternOffsetHandler);

/**
 * POST /api/v1/shift-profiles/update-employee-pattern-offset
 * Обновить смещение паттерна для конкретного сотрудника (требуется аутентификация)
 */
router.post('/update-employee-pattern-offset', authenticate, shiftProfilesController.updateEmployeePatternOffsetHandler);

/**
 * GET /api/v1/shift-profiles/:id
 * Получить профиль смены по ID
 */
router.get('/:id', authenticate, shiftProfilesController.getShiftProfileById);

/**
 * PUT /api/v1/shift-profiles/:id
 * Обновить профиль смены (требуется аутентификация)
 */
router.put('/:id', authenticate, shiftProfilesController.updateShiftProfile);

/**
 * DELETE /api/v1/shift-profiles/:id
 * Удалить профиль смены (требуется аутентификация)
 */
router.delete('/:id', authenticate, shiftProfilesController.deleteShiftProfileHandler);

/**
 * POST /api/v1/shift-profiles/:id/clone
 * Клонировать профиль смены (требуется аутентификация)
 */
router.post('/:id/clone', authenticate, shiftProfilesController.cloneShiftProfileHandler);

export default router;

