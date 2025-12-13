const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, checkTeamAccess } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

// All routes require authentication and team access
router.use(protect);
router.use(checkTeamAccess);

// GET /api/teams/:teamId/incidents
router.get('/', incidentController.getIncidents);

// GET /api/teams/:teamId/incidents/active-count
router.get('/active-count', incidentController.getActiveIncidentsCount);

// GET /api/teams/:teamId/incidents/:id
router.get('/:id', incidentController.getIncident);

// POST /api/teams/:teamId/incidents
router.post('/', incidentController.createIncident);

// PUT /api/teams/:teamId/incidents/:id
router.put('/:id', incidentController.updateIncident);

// POST /api/teams/:teamId/incidents/:id/timeline
router.post('/:id/timeline', incidentController.addTimelineEntry);

// DELETE /api/teams/:teamId/incidents/:id
router.delete('/:id', incidentController.deleteIncident);

module.exports = router;
