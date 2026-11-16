import { Router } from 'express';
import { exportController } from './export.controller.js';

const router = Router();

// GET /api/exports/roster/:id/csv - Download monthly roster CSV
router.get('/roster/:id/csv', (req, res, next) => exportController.exportRosterCSV(req, res, next));

// GET /api/exports/conflicts/csv - Download conflicts report CSV
router.get('/conflicts/csv', (req, res, next) => exportController.exportConflictsCSV(req, res, next));

// GET /api/exports/assignments/csv - Download assignments CSV
router.get('/assignments/csv', (req, res, next) => exportController.exportAssignmentsCSV(req, res, next));

export default router;
