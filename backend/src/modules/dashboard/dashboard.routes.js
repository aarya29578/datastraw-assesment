import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';

const router = Router();

// GET /api/dashboard/metrics - Dynamic aggregated KPIs
router.get('/metrics', (req, res, next) => dashboardController.getMetrics(req, res, next));

// GET /api/dashboard/overview - Complete dashboard overview with pods and recent conflicts
router.get('/overview', (req, res, next) => dashboardController.getOverview(req, res, next));

export default router;
