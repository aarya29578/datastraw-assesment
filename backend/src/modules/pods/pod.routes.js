import { Router } from 'express';
import { podController } from './pod.controller.js';

const router = Router();

/**
 * Pod Management Routes
 * Base path: /api/pods
 */

// POST /api/pods - Create a new pod
router.post('/', (req, res, next) => podController.createPod(req, res, next));

// GET /api/pods - Retrieve all pods (paginated, searchable)
router.get('/', (req, res, next) => podController.getAllPods(req, res, next));

// GET /api/pods/:id - Retrieve pod by ID
router.get('/:id', (req, res, next) => podController.getPodById(req, res, next));

// PUT /api/pods/:id - Update pod details
router.put('/:id', (req, res, next) => podController.updatePod(req, res, next));

// DELETE /api/pods/:id - Delete a pod
router.delete('/:id', (req, res, next) => podController.deletePod(req, res, next));

export default router;
