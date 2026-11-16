import { Router } from 'express';
import { conflictController } from './conflict.controller.js';

const router = Router();

// GET /api/conflicts - List conflicts (filterable by roster_id, severity, status, conflict_type)
router.get('/', (req, res, next) => conflictController.getAllConflicts(req, res, next));

// GET /api/conflicts/:id - Get conflict by ID
router.get('/:id', (req, res, next) => conflictController.getConflictById(req, res, next));

// POST /api/conflicts/validate/:rosterId - Run conflict validation engine for a roster
router.post('/validate/:rosterId', (req, res, next) => conflictController.validateRoster(req, res, next));

// PATCH /api/conflicts/:id/resolve - Mark conflict as resolved
router.patch('/:id/resolve', (req, res, next) => conflictController.resolveConflict(req, res, next));

// POST /api/conflicts/:id/resolve-with-replacement - Resolve conflict by scheduling replacement employee
router.post('/:id/resolve-with-replacement', (req, res, next) =>
  conflictController.resolveWithReplacement(req, res, next)
);

// PATCH /api/conflicts/:id/ignore - Mark conflict as ignored
router.patch('/:id/ignore', (req, res, next) => conflictController.ignoreConflict(req, res, next));

export default router;
