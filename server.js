require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const connectDB = require('./config/db');
const passport = require('./config/passport');
const socketService = require('./services/socketService');

// Choose worker based on environment
const USE_BULLMQ = process.env.USE_BULLMQ === 'true';

// Import routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const monitorRoutes = require('./routes/monitors');
const statusRoutes = require('./routes/status');
const incidentRoutes = require('./routes/incidents');
const alertRoutes = require('./routes/alerts');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const heartbeatRoutes = require('./routes/heartbeat');
const cronjobRoutes = require('./routes/cronjob');
const reportsRoutes = require('./routes/reports');
const maintenanceRoutes = require('./routes/maintenance');

// Initialize express
const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
socketService.init(httpServer);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

// Raw body for Stripe webhooks (must be before express.json())
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Initialize Passport
app.use(passport.initialize());

// Health check endpoint
app.get('/health', async (req, res) => {
    let queueStatus = 'not available';

    if (USE_BULLMQ) {
        try {
            const { getQueueStats } = require('./config/queue');
            queueStatus = await getQueueStats();
        } catch (e) {
            queueStatus = 'error: ' + e.message;
        }
    }

    res.status(200).json({
        success: true,
        message: 'Balaping API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        worker: USE_BULLMQ ? 'BullMQ' : 'In-Memory',
        queue: queueStatus,
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/teams/:teamId/monitors', monitorRoutes);
app.use('/api/teams/:teamId/incidents', incidentRoutes);
app.use('/api/teams/:teamId/alerts', alertRoutes);
app.use('/api/teams/:teamId/billing', billingRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/heartbeat', heartbeatRoutes);
app.use('/api/cronjob', cronjobRoutes);
app.use('/api/teams/:teamId/reports', reportsRoutes);
app.use('/api/teams/:teamId/maintenance', maintenanceRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global Stripe webhook (alternative path)
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }),
    require('./controllers/billingController').handleWebhook
);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});

// Start server
const PORT = process.env.PORT || 4000;

const server = httpServer.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ⚡ Balaping API Server v1.0.0                       ║
║                                                       ║
║   Running on: http://localhost:${PORT}                   ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(16)}                ║
║   Worker: ${USE_BULLMQ ? 'BullMQ (Redis)' : 'In-Memory'}                      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

    // Initialize the worker
    if (USE_BULLMQ) {
        const { initializeWorkers } = require('./workers/bullWorker');
        await initializeWorkers();
    } else {
        const { initializeWorker } = require('./workers/worker');
        await initializeWorker();
    }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    server.close(async () => {
        console.log('HTTP server closed');

        if (USE_BULLMQ) {
            const { shutdownWorkers } = require('./workers/bullWorker');
            const { closeQueues } = require('./config/queue');
            const { closeRedis } = require('./config/redis');

            await shutdownWorkers();
            await closeQueues();
            await closeRedis();
        }

        console.log('All connections closed. Goodbye! 👋');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
