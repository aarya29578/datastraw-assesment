import { Router } from 'express';
import { assignmentController } from './assignment.controller.js';

const router = Router();

// POST /api/assignments - Create assignment (supports single process or multi-process fan-out)
router.post('/', (req, res, next) => assignmentController.createAssignment(req, res, next));

// GET /api/assignments - List assignments (searchable, filterable by employee, pod, brand, process)
router.get('/', (req, res, next) => assignmentController.getAllAssignments(req, res, next));

// GET /api/assignments/:id - Retrieve assignment by ID
router.get('/:id', (req, res, next) => assignmentController.getAssignmentById(req, res, next));

// PUT /api/assignments/:id - Update assignment
router.put('/:id', (req, res, next) => assignmentController.updateAssignment(req, res, next));

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', (req, res, next) => assignmentController.deleteAssignment(req, res, next));

export default router;
