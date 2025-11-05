import { Router } from 'express';
import * as shiftProfilesController from '../controllers/shiftProfilesController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router({ mergeParams: true });

/**
 * Все маршруты требуют аутентификации и доступа к схеме
 */
router.use(authenticate);
router.use(authorize('editor'));

/**
 * POST /api/v1/schedules/:scheduleId/generate-shifts
 * Сгенерировать смены на основе профиля смены
 */
router.post('/generate-shifts', shiftProfilesController.generateShifts);

export default router;

