import { Router } from 'express';
import { processController } from './process.controller.js';

const router = Router();

/**
 * Process Management Routes
 * Base path: /api/processes
 */

// POST /api/processes - Create a new process
router.post('/', (req, res, next) => processController.createProcess(req, res, next));

// GET /api/processes - Retrieve all processes (paginated, searchable, status filter)
router.get('/', (req, res, next) => processController.getAllProcesses(req, res, next));

// GET /api/processes/:id - Retrieve process by ID
router.get('/:id', (req, res, next) => processController.getProcessById(req, res, next));

// PUT /api/processes/:id - Update process details
router.put('/:id', (req, res, next) => processController.updateProcess(req, res, next));

// DELETE /api/processes/:id - Soft-deactivate process
router.delete('/:id', (req, res, next) => processController.deactivateProcess(req, res, next));

export default router;
