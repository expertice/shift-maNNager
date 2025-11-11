/**
 * Routes для проверки соответствия ТК РФ
 */

import express from 'express';
import {
  getSettings,
  updateSettingsController,
  getAllWorkHoursNorms,
  getWorkHoursNormByYear,
  updateWorkHoursNormController,
  syncWorkHoursNorm,
  calculateWorkHoursNormController,
  validateScheduleController,
  getViolations,
  resolveViolationController,
  getViolationStatsController,
} from '../controllers/laborLawComplianceController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Все роуты требуют аутентификации
router.use(authenticate);

// Настройки
router.get('/settings', getSettings);
router.put('/settings', updateSettingsController);

// Нормы часов
router.get('/work-hours-norms', getAllWorkHoursNorms);
router.get('/work-hours-norms/:year', getWorkHoursNormByYear);
router.put('/work-hours-norms/:year', updateWorkHoursNormController);
router.post('/work-hours-norms/:year/sync', syncWorkHoursNorm);
router.post('/work-hours-norms/:year/calculate', calculateWorkHoursNormController);

// Валидация
router.post('/validate/:scheduleId', validateScheduleController);
router.get('/violations/:scheduleId', getViolations);
router.put('/violations/:violationId/resolve', resolveViolationController);
router.get('/violations/:scheduleId/stats', getViolationStatsController);

export default router;

