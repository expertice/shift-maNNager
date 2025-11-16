import { Router } from 'express';
import authRoutes from './authRoutes';
import schedulesRoutes from './schedulesRoutes';
import shiftProfilesRoutes from './shiftProfilesRoutes';
import scheduleActionsRoutes from './scheduleActionsRoutes';
import laborLawComplianceRoutes from './laborLawCompliance';
import rosterSnapshotRoutes from './rosterSnapshot';

const router = Router();

/**
 * Главный роутер API
 * Все маршруты будут добавляться здесь
 */

// Auth routes
router.use('/auth', authRoutes);

// Shift Profiles routes
router.use('/shift-profiles', shiftProfilesRoutes);

// Schedules routes
router.use('/schedules', schedulesRoutes);

// Schedule actions (generate-shifts, etc.)
router.use('/schedules/:scheduleId', scheduleActionsRoutes);

// Labor law compliance routes
router.use('/labor-law', laborLawComplianceRoutes);

// Roster snapshot routes
router.use('/', rosterSnapshotRoutes);

// TODO: Добавить остальные роуты
// router.use('/conflicts', conflictsRouter);
// router.use('/analytics', analyticsRouter);
// router.use('/history', historyRouter);
// router.use('/permissions', permissionsRouter);

export default router;

