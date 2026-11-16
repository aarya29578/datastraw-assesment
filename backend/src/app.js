
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

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',

    // Main Vercel production domain
    'https://datastraw-assessment.vercel.app',

    // Current Vercel deployment domain
    'https://datastraw-assessment-jfsigql7h-aarya-2c0a.vercel.app',

    // Git main deployment domain
    'https://datastraw-assessment-git-main-aarya-2c0a.vercel.app',
];

const corsOptions = {
    origin: (origin, callback) => {

        // Allow requests without an Origin header
        if (!origin) {
            return callback(null, true);
        }

        // Allow configured frontend domains
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow preview deployments belonging to this Vercel project
        const isVercelPreview =
            /^https:\/\/datastraw-assessment-[a-z0-9-]+-aarya-2c0a\.vercel\.app$/.test(origin);

        if (isVercelPreview) {
            return callback(null, true);
        }

        console.error('[CORS Error] Origin not allowed:', origin);

        return callback(new Error('Origin not allowed by CORS'));
    },

    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ],

    optionsSuccessStatus: 204
};

// Apply CORS before all other middleware and routes
app.use(cors(corsOptions));

// --------------------------------------------------
// GLOBAL MIDDLEWARES
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiterMiddleware);

// --------------------------------------------------
// HEALTH CHECK API
// --------------------------------------------------

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'DataStraw Backend is running',
        timestamp: new Date().toISOString()
    });
});

// --------------------------------------------------
// ROOT ROUTE
// --------------------------------------------------

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        name: 'DataStraw Backend API',
        version: '1.0.0',
        documentation: '/api/health'
    });
});

// --------------------------------------------------
// FEATURE MODULE ROUTES
// --------------------------------------------------

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

// --------------------------------------------------
// 404 ROUTE NOT FOUND MIDDLEWARE
// --------------------------------------------------

app.use(notFoundMiddleware);

// --------------------------------------------------
// CENTRALIZED ERROR-HANDLING MIDDLEWARE
// --------------------------------------------------

app.use(errorMiddleware);

// Export Express Application
export default app;
