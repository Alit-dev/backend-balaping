/**
 * Incident Controller
 * Handles incident management - auto/manual creation, updates, timeline
 */

const Incident = require('../models/Incident');
const Monitor = require('../models/Monitor');
const { sendAlert } = require('../services/alerts');

// @desc    Get all incidents for team
// @route   GET /api/teams/:teamId/incidents
// @access  Private
exports.getIncidents = async (req, res) => {
    try {
        const { status, monitorId, search, limit = 50, offset = 0 } = req.query;

        const query = { teamId: req.params.teamId };

        // Status filter
        if (status) {
            if (status === 'ongoing') {
                query.status = { $ne: 'resolved' };
            } else {
                query.status = status;
            }
        }

        // Monitor filter
        if (monitorId) {
            query.monitorId = monitorId;
        }

        // Search filter (title or description)
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const incidents = await Incident.find(query)
            .populate('monitorId', 'name url type')
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await Incident.countDocuments(query);

        res.status(200).json({
            success: true,
            incidents,
            total,
        });
    } catch (error) {
        console.error('Get incidents error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get single incident
// @route   GET /api/teams/:teamId/incidents/:id
// @access  Private
exports.getIncident = async (req, res) => {
    try {
        const incident = await Incident.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        }).populate('monitorId', 'name url type');

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        res.status(200).json({ success: true, incident });
    } catch (error) {
        console.error('Get incident error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Create manual incident
// @route   POST /api/teams/:teamId/incidents
// @access  Private
exports.createIncident = async (req, res) => {
    try {
        const {
            title,
            description,
            severity = 'major',
            monitorId,
            affectedServices = [],
            notifySubscribers = true,
        } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const incident = await Incident.create({
            teamId: req.params.teamId,
            monitorId,
            title,
            description,
            severity,
            type: 'manual',
            affectedServices,
            notifySubscribers,
            timeline: [{
                status: 'investigating',
                message: description || 'Incident created',
                createdBy: req.user._id,
            }],
        });

        // If linked to a monitor, update the monitor
        if (monitorId) {
            await Monitor.findByIdAndUpdate(monitorId, {
                currentIncidentId: incident._id,
                lastStatus: 'down',
            });
        }

        // Send notifications if enabled
        if (notifySubscribers) {
            await sendIncidentNotification(incident, req.params.teamId, 'created');
        }

        res.status(201).json({ success: true, incident });
    } catch (error) {
        console.error('Create incident error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update incident status
// @route   PUT /api/teams/:teamId/incidents/:id
// @access  Private
exports.updateIncident = async (req, res) => {
    try {
        const { status, message, severity, title, description } = req.body;

        const incident = await Incident.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        // Update fields
        if (title) incident.title = title;
        if (description) incident.description = description;
        if (severity) incident.severity = severity;

        // Add timeline entry if status changed
        if (status && status !== incident.status) {
            incident.status = status;
            incident.timeline.push({
                status,
                message: message || `Status updated to ${status}`,
                createdBy: req.user._id,
                createdAt: new Date(),
            });

            // If resolved, set resolved time and update monitor
            if (status === 'resolved') {
                incident.resolvedAt = new Date();
                incident.duration = incident.resolvedAt - incident.startedAt;

                if (incident.monitorId) {
                    await Monitor.findByIdAndUpdate(incident.monitorId, {
                        currentIncidentId: null,
                    });
                }
            }

            // Send notification
            if (incident.notifySubscribers) {
                await sendIncidentNotification(incident, req.params.teamId, status);
            }
        }

        await incident.save();

        res.status(200).json({ success: true, incident });
    } catch (error) {
        console.error('Update incident error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Add timeline entry
// @route   POST /api/teams/:teamId/incidents/:id/timeline
// @access  Private
exports.addTimelineEntry = async (req, res) => {
    try {
        const { status, message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const incident = await Incident.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        // Update status if provided
        if (status) {
            incident.status = status;
        }

        incident.timeline.push({
            status: status || incident.status,
            message,
            createdBy: req.user._id,
            createdAt: new Date(),
        });

        await incident.save();

        // Notify if needed
        if (incident.notifySubscribers) {
            await sendIncidentNotification(incident, req.params.teamId, 'update');
        }

        res.status(200).json({ success: true, incident });
    } catch (error) {
        console.error('Add timeline error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete incident
// @route   DELETE /api/teams/:teamId/incidents/:id
// @access  Private (Admin only)
exports.deleteIncident = async (req, res) => {
    try {
        const incident = await Incident.findOneAndDelete({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }

        // Clear from monitor if linked
        if (incident.monitorId) {
            await Monitor.findByIdAndUpdate(incident.monitorId, {
                currentIncidentId: null,
            });
        }

        res.status(200).json({ success: true, message: 'Incident deleted' });
    } catch (error) {
        console.error('Delete incident error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get active incidents count
// @route   GET /api/teams/:teamId/incidents/active-count
// @access  Private
exports.getActiveIncidentsCount = async (req, res) => {
    try {
        const count = await Incident.countDocuments({
            teamId: req.params.teamId,
            status: { $ne: 'resolved' },
        });

        res.status(200).json({ success: true, count });
    } catch (error) {
        console.error('Get active count error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Send incident notification
 */
async function sendIncidentNotification(incident, teamId, eventType) {
    try {
        const Team = require('../models/Team');
        const team = await Team.findById(teamId);

        await sendAlert(teamId, 'incident', {
            incident,
            teamName: team?.name || 'Unknown Team',
            eventType,
        });
    } catch (error) {
        console.error('Incident notification failed:', error);
    }
}
