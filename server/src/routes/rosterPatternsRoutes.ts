import { Router } from 'express';
import { authorize } from '../middleware/authorize';
import * as controller from '../controllers/rosterPatternsController';

const router = Router({ mergeParams: true });

router.use(authorize('viewer'));

// GET instances for schedule
router.get('/', controller.getInstances);

// Update sequence (editor+)
router.patch('/:employeeId/sequence', authorize('editor'), controller.patchSequence);

// Update start index (editor+)
router.patch('/:employeeId/start-index', authorize('editor'), controller.patchStartIndex);

// Lock/unlock indices (editor+)
router.post('/:employeeId/lock', authorize('editor'), controller.lock);
router.post('/:employeeId/unlock', authorize('editor'), controller.unlock);

export default router;


