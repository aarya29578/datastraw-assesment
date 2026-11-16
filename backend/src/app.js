import express from 'express';
import cors from 'cors';
import employeeRoutes from './modules/employees/employee.routes.js';
import podRoutes from './modules/pods/pod.routes.js';
import brandRoutes from './modules/brands/brand.routes.js';
import processRoutes from './modules/processes/process.routes.js';
import assignmentRoutes from './modules/assignments/assignment.routes.js';
import workingRuleRoutes from './modules/working-rules/workingRule.routes.js';
import availabilityRoutes from './modules/availability/availability.routes.js';
import rosterRoutes from './modules/roster/roster.routes.js';
import conflictRoutes from './modules/conflicts/conflict.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import exportRoutes from './modules/exports/export.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import { notFoundMiddleware } from './middlewares/notFound.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { rateLimiterMiddleware } from './middlewares/rateLimiter.middleware.js';

// Initialize Express Application
const app = express();

// Global Middlewares
app.use(cors({
  origin: [
        "http://localhost:5173",
        "https://datastraw-assesment.vercel.app"
    ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiterMiddleware);

/**
 * Health Check API
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DataStraw Backend is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root Route for quick browser verification
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'DataStraw Backend API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

/**
 * Feature Module Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/pods', podRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/working-rules', workingRuleRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/rosters', rosterRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exports', exportRoutes);

// 404 Route Not Found Middleware
app.use(notFoundMiddleware);

// Centralized Error-Handling Middleware
app.use(errorMiddleware);

export default app;
