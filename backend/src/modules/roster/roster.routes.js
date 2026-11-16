import { Router } from 'express';
import { rosterController } from './roster.controller.js';

const router = Router();

// POST /api/rosters/generate - Generate monthly baseline roster
router.post('/generate', (req, res, next) => rosterController.generateRoster(req, res, next));

// GET /api/rosters - List all rosters (filterable by year, month, status)
router.get('/', (req, res, next) => rosterController.getAllRosters(req, res, next));

// GET /api/rosters/active-cycle - Get active roster cycle (latest published/created)
router.get('/active-cycle', (req, res, next) => rosterController.getActiveCycle(req, res, next));

// GET /api/rosters/:id - Get roster by ID
router.get('/:id', (req, res, next) => rosterController.getRosterById(req, res, next));

// GET /api/rosters/:id/entries - Get all entries and 2D grid matrix
router.get('/:id/entries', (req, res, next) => rosterController.getRosterEntries(req, res, next));

// PUT /api/rosters/:id/entries/:entryId - Manually update single entry
router.put('/:id/entries/:entryId', (req, res, next) => rosterController.updateRosterEntry(req, res, next));

// POST /api/rosters/:id/entries/bulk-update - Bulk update entries
router.post('/:id/entries/bulk-update', (req, res, next) => rosterController.bulkUpdateEntries(req, res, next));

// PATCH /api/rosters/:id/status - Update roster lifecycle status (DRAFT -> REVIEW -> PUBLISHED)
router.patch('/:id/status', (req, res, next) => rosterController.updateRosterStatus(req, res, next));

export default router;
