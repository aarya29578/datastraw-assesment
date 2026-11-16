import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// POST /api/auth/login - User login
router.post('/login', (req, res, next) => authController.login(req, res, next));

// POST /api/auth/register - Register user
router.post('/register', (req, res, next) => authController.register(req, res, next));

// GET /api/auth/me - Get current user profile
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

// POST /api/auth/logout - User logout
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

export default router;
