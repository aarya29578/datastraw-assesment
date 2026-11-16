import { Router } from 'express';
import { brandController } from './brand.controller.js';

const router = Router();

/**
 * Brand Management Routes
 * Base path: /api/brands
 */

// POST /api/brands - Create a new brand
router.post('/', (req, res, next) => brandController.createBrand(req, res, next));

// GET /api/brands - Retrieve all brands (paginated, searchable, status filter)
router.get('/', (req, res, next) => brandController.getAllBrands(req, res, next));

// GET /api/brands/:id - Retrieve brand by ID
router.get('/:id', (req, res, next) => brandController.getBrandById(req, res, next));

// PUT /api/brands/:id - Update brand details
router.put('/:id', (req, res, next) => brandController.updateBrand(req, res, next));

// DELETE /api/brands/:id - Soft-deactivate brand
router.delete('/:id', (req, res, next) => brandController.deactivateBrand(req, res, next));

export default router;
