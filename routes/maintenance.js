const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, checkTeamAccess } = require('../middleware/auth');

// All routes require authentication and team access
router.use(protect);
router.use(checkTeamAccess);

// Mock maintenance data store (in production, use MongoDB model)
const maintenanceStore = new Map();

// GET /api/teams/:teamId/maintenance - List maintenance windows
router.get('/', async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const teamMaintenance = Array.from(maintenanceStore.values())
            .filter(m => m.teamId === teamId);

        res.json({
            success: true,
            maintenance: teamMaintenance,
        });
    } catch (error) {
        console.error('Get maintenance error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch maintenance windows' });
    }
});

// POST /api/teams/:teamId/maintenance - Create maintenance window
router.post('/', async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const { title, description, startTime, endTime, affectedMonitors, recurring } = req.body;

        const maintenanceId = Date.now().toString();
        const maintenance = {
            _id: maintenanceId,
            teamId,
            title,
            description,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            affectedMonitors: affectedMonitors || [],
            recurring: recurring || 'none',
            status: 'scheduled',
            createdAt: new Date(),
        };

        maintenanceStore.set(maintenanceId, maintenance);

        res.json({
            success: true,
            message: 'Maintenance window created',
            maintenance,
        });
    } catch (error) {
        console.error('Create maintenance error:', error);
        res.status(500).json({ success: false, message: 'Failed to create maintenance window' });
    }
});

// PUT /api/teams/:teamId/maintenance/:id - Update maintenance window
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const maintenance = maintenanceStore.get(id);
        if (!maintenance) {
            return res.status(404).json({ success: false, message: 'Maintenance window not found' });
        }

        Object.assign(maintenance, updates, { updatedAt: new Date() });
        maintenanceStore.set(id, maintenance);

        res.json({
            success: true,
            message: 'Maintenance window updated',
            maintenance,
        });
    } catch (error) {
        console.error('Update maintenance error:', error);
        res.status(500).json({ success: false, message: 'Failed to update maintenance window' });
    }
});

// DELETE /api/teams/:teamId/maintenance/:id - Delete maintenance window
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!maintenanceStore.has(id)) {
            return res.status(404).json({ success: false, message: 'Maintenance window not found' });
        }

        maintenanceStore.delete(id);

        res.json({
            success: true,
            message: 'Maintenance window deleted',
        });
    } catch (error) {
        console.error('Delete maintenance error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete maintenance window' });
    }
});

module.exports = router;
