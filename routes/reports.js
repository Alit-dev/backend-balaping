const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, checkTeamAccess } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// All routes require authentication and team access
router.use(protect);
router.use(checkTeamAccess);

// GET /api/teams/:teamId/reports - Generate report
router.get('/', reportController.generateReport);

// GET /api/teams/:teamId/reports/download - Download report
router.get('/download', reportController.downloadReport);

// POST /api/teams/:teamId/reports/schedule - Schedule report
router.post('/schedule', reportController.scheduleReport);

module.exports = router;
