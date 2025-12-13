const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, checkTeamAccess } = require('../middleware/auth');
const alertController = require('../controllers/alertController');

// All routes require authentication and team access
router.use(protect);
router.use(checkTeamAccess);

// GET /api/teams/:teamId/alerts
router.get('/', alertController.getAlertChannels);

// GET /api/teams/:teamId/alerts/:id
router.get('/:id', alertController.getAlertChannel);

// POST /api/teams/:teamId/alerts
router.post('/', alertController.createAlertChannel);

// PUT /api/teams/:teamId/alerts/:id
router.put('/:id', alertController.updateAlertChannel);

// DELETE /api/teams/:teamId/alerts/:id
router.delete('/:id', alertController.deleteAlertChannel);

// POST /api/teams/:teamId/alerts/:id/test
router.post('/:id/test', alertController.testAlertChannel);

// POST /api/teams/:teamId/alerts/:id/toggle
router.post('/:id/toggle', alertController.toggleAlertChannel);

module.exports = router;
