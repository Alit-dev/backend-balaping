const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All routes require admin access
router.use(protect);
router.use(isAdmin);

// GET /api/admin/stats
router.get('/stats', adminController.getDashboardStats);

// Users
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Monitors
router.get('/monitors', adminController.getMonitors);

// Incidents
router.get('/incidents', adminController.getIncidents);

// System
router.get('/system', adminController.getSystemHealth);

// Billing
router.get('/billing', adminController.getBillingOverview);

// Security logs
router.get('/security-logs', adminController.getSecurityLogs);

module.exports = router;
