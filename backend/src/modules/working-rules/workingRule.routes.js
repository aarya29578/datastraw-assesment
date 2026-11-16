import { Router } from 'express';
import { workingRuleController } from './workingRule.controller.js';

const router = Router();

// POST /api/working-rules - Create working rule
router.post('/', (req, res, next) => workingRuleController.createWorkingRule(req, res, next));

// GET /api/working-rules - List working rules (filterable by brand, process, is_active, target_date)
router.get('/', (req, res, next) => workingRuleController.getAllWorkingRules(req, res, next));

// GET /api/working-rules/:id - Get rule by ID
router.get('/:id', (req, res, next) => workingRuleController.getWorkingRuleById(req, res, next));

// PUT /api/working-rules/:id - Update working rule
router.put('/:id', (req, res, next) => workingRuleController.updateWorkingRule(req, res, next));

// DELETE /api/working-rules/:id - Delete working rule
router.delete('/:id', (req, res, next) => workingRuleController.deleteWorkingRule(req, res, next));

export default router;
