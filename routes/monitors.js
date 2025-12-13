const express = require('express');
const router = express.Router({ mergeParams: true });
const {
    getMonitors,
    getMonitor,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    pauseMonitor,
    resumeMonitor,
    getMonitorHistory,
    getMonitorStats,
    getDashboardStats,
} = require('../controllers/monitorController');
const { protect } = require('../middleware/auth');
const { teamAccess } = require('../middleware/teamAccess');

// All routes require authentication and team access
router.use(protect);
router.use(teamAccess);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Monitor CRUD
router.get('/', getMonitors);
router.post('/', createMonitor);
router.get('/:id', getMonitor);
router.put('/:id', updateMonitor);
router.delete('/:id', deleteMonitor);

// Monitor actions
router.post('/:id/pause', pauseMonitor);
router.post('/:id/resume', resumeMonitor);

// Monitor data
router.get('/:id/history', getMonitorHistory);
router.get('/:id/stats', getMonitorStats);

module.exports = router;
