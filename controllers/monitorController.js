const Monitor = require('../models/Monitor');
const MonitorHistory = require('../models/MonitorHistory');
const workerCache = require('../workers/workerCache');
const socketService = require('../services/socketService');

// @desc    Get all monitors for team
// @route   GET /api/teams/:teamId/monitors
// @access  Private
exports.getMonitors = async (req, res) => {
    try {
        const monitors = await Monitor.find({ teamId: req.params.teamId }).sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            monitors,
        });
    } catch (error) {
        console.error('Get monitors error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get single monitor
// @route   GET /api/teams/:teamId/monitors/:id
// @access  Private
exports.getMonitor = async (req, res) => {
    try {
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        res.status(200).json({
            success: true,
            monitor,
        });
    } catch (error) {
        console.error('Get monitor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

const { addMonitorToQueue, removeMonitorFromQueue } = require('../workers/bullWorker');
const USE_BULLMQ = process.env.USE_BULLMQ === 'true';

// @desc    Create monitor
// @route   POST /api/teams/:teamId/monitors
// @access  Private
exports.createMonitor = async (req, res) => {
    try {
        const {
            name,
            url,
            method = 'GET',
            intervalSec = 60,
            expectedCode = 200,
            timeout = 30000,
            headers = {},
            body = '',
            alertAfterFailures = 1,
            alertChannels = [],
        } = req.body;

        if (!name || !url) {
            return res.status(400).json({
                success: false,
                message: 'Name and URL are required',
            });
        }

        const monitor = new Monitor({
            teamId: req.params.teamId,
            name,
            url,
            method,
            intervalSec,
            expectedCode,
            timeout,
            headers,
            body,
            alertAfterFailures,
            alertChannels,
        });

        await monitor.save();

        // Add to worker
        if (USE_BULLMQ) {
            await addMonitorToQueue(monitor);
        } else {
            workerCache.addMonitor(monitor);
        }

        // Emit event
        socketService.emitToTeam(req.params.teamId, 'monitor_created', monitor);

        res.status(201).json({
            success: true,
            monitor,
        });
    } catch (error) {
        console.error('Create monitor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Update monitor
// @route   PUT /api/teams/:teamId/monitors/:id
// @access  Private
exports.updateMonitor = async (req, res) => {
    try {
        const {
            name,
            url,
            method,
            intervalSec,
            expectedCode,
            timeout,
            headers,
            body,
            alertAfterFailures,
        } = req.body;

        const monitor = await Monitor.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        // Update fields
        if (name) monitor.name = name;
        if (url) monitor.url = url;
        if (method) monitor.method = method;
        if (intervalSec) monitor.intervalSec = intervalSec;
        if (expectedCode) monitor.expectedCode = expectedCode;
        if (timeout) monitor.timeout = timeout;
        if (headers) monitor.headers = headers;
        if (body !== undefined) monitor.body = body;
        if (alertAfterFailures) monitor.alertAfterFailures = alertAfterFailures;
        if (req.body.alertChannels) monitor.alertChannels = req.body.alertChannels;

        await monitor.save();

        // Update in worker
        if (USE_BULLMQ) {
            // For BullMQ, we remove and re-add to update the job data/schedule
            await removeMonitorFromQueue(monitor._id.toString());
            if (monitor.active) {
                await addMonitorToQueue(monitor);
            }
        } else {
            workerCache.updateMonitor(monitor);
        }

        // Emit event
        socketService.emitToTeam(req.params.teamId, 'monitor_updated', monitor);

        res.status(200).json({
            success: true,
            monitor,
        });
    } catch (error) {
        console.error('Update monitor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Delete monitor
// @route   DELETE /api/teams/:teamId/monitors/:id
// @access  Private
exports.deleteMonitor = async (req, res) => {
    try {
        const monitor = await Monitor.findOneAndDelete({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        // Remove from worker
        if (USE_BULLMQ) {
            await removeMonitorFromQueue(monitor._id.toString());
        } else {
            workerCache.removeMonitor(monitor._id.toString());
        }

        // Delete history
        await MonitorHistory.deleteMany({ monitorId: monitor._id });

        // Emit event
        socketService.emitToTeam(req.params.teamId, 'monitor_deleted', req.params.id);

        res.status(200).json({
            success: true,
            message: 'Monitor deleted',
        });
    } catch (error) {
        console.error('Delete monitor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Pause monitor
// @route   POST /api/teams/:teamId/monitors/:id/pause
// @access  Private
exports.pauseMonitor = async (req, res) => {
    try {
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        monitor.active = false;
        await monitor.save();

        // Update worker
        if (USE_BULLMQ) {
            await removeMonitorFromQueue(monitor._id.toString());
        } else {
            workerCache.pauseMonitor(monitor._id.toString());
        }

        // Emit event
        socketService.emitToTeam(req.params.teamId, 'monitor_updated', monitor);

        res.status(200).json({
            success: true,
            message: 'Monitor paused',
            monitor,
        });
    } catch (error) {
        console.error('Pause monitor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Resume monitor
// @route   POST /api/teams/:teamId/monitors/:id/resume
// @access  Private
exports.resumeMonitor = async (req, res) => {
    try {
        const monitor = await Monitor.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        monitor.active = true;
        monitor.lastStatus = 'pending';
        monitor.consecutiveFailures = 0;
        await monitor.save();

        // Update worker
        if (USE_BULLMQ) {
            await addMonitorToQueue(monitor);
        } else {
            workerCache.resumeMonitor(monitor);
        }

        // Emit event
        socketService.emitToTeam(req.params.teamId, 'monitor_updated', monitor);

        res.status(200).json({
            success: true,
            message: 'Monitor resumed',
            monitor,
        });
    } catch (error) {
        console.error('Resume monitor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get monitor history
// @route   GET /api/teams/:teamId/monitors/:id/history
// @access  Private
exports.getMonitorHistory = async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const monitor = await Monitor.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        const history = await MonitorHistory.find({ monitorId: monitor._id })
            .sort({ checkedAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await MonitorHistory.countDocuments({ monitorId: monitor._id });

        res.status(200).json({
            success: true,
            history,
            total,
        });
    } catch (error) {
        console.error('Get monitor history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get monitor stats
// @route   GET /api/teams/:teamId/monitors/:id/stats
// @access  Private
exports.getMonitorStats = async (req, res) => {
    try {
        const { period = '24h' } = req.query;

        const monitor = await Monitor.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!monitor) {
            return res.status(404).json({
                success: false,
                message: 'Monitor not found',
            });
        }

        // Calculate time range
        let startDate;
        switch (period) {
            case '1h':
                startDate = new Date(Date.now() - 60 * 60 * 1000);
                break;
            case '24h':
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        const history = await MonitorHistory.find({
            monitorId: monitor._id,
            checkedAt: { $gte: startDate },
        }).sort({ checkedAt: 1 });

        // Calculate stats
        const totalChecks = history.length;
        const successfulChecks = history.filter((h) => h.success).length;
        const uptimePercentage = totalChecks > 0
            ? ((successfulChecks / totalChecks) * 100).toFixed(2)
            : 100;

        const responseTimes = history
            .filter((h) => h.responseMs)
            .map((h) => h.responseMs);

        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;

        const minResponseTime = responseTimes.length > 0
            ? Math.min(...responseTimes)
            : 0;

        const maxResponseTime = responseTimes.length > 0
            ? Math.max(...responseTimes)
            : 0;

        // Get incidents (status changes to down)
        const incidents = [];
        let currentIncident = null;

        for (let i = 0; i < history.length; i++) {
            const check = history[i];
            if (!check.success && !currentIncident) {
                currentIncident = {
                    startedAt: check.checkedAt,
                    error: check.error,
                };
            } else if (check.success && currentIncident) {
                currentIncident.endedAt = check.checkedAt;
                currentIncident.duration = check.checkedAt - currentIncident.startedAt;
                incidents.push(currentIncident);
                currentIncident = null;
            }
        }

        // If still in incident
        if (currentIncident) {
            currentIncident.ongoing = true;
            incidents.push(currentIncident);
        }

        res.status(200).json({
            success: true,
            stats: {
                uptimePercentage: parseFloat(uptimePercentage),
                totalChecks,
                successfulChecks,
                failedChecks: totalChecks - successfulChecks,
                avgResponseTime,
                minResponseTime,
                maxResponseTime,
                incidents: incidents.reverse().slice(0, 10),
            },
            chartData: history.map((h) => ({
                time: h.checkedAt,
                responseMs: h.responseMs || 0,
                success: h.success,
            })),
        });
    } catch (error) {
        console.error('Get monitor stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get dashboard stats
// @route   GET /api/teams/:teamId/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
    try {
        const monitors = await Monitor.find({ teamId: req.params.teamId });

        const totalMonitors = monitors.length;
        const activeMonitors = monitors.filter((m) => m.active).length;
        const upMonitors = monitors.filter((m) => m.lastStatus === 'up').length;
        const downMonitors = monitors.filter((m) => m.lastStatus === 'down').length;

        // Get 24h history for all monitors
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const history = await MonitorHistory.find({
            monitorId: { $in: monitors.map((m) => m._id) },
            checkedAt: { $gte: yesterday },
        });

        const totalChecks = history.length;
        const successfulChecks = history.filter((h) => h.success).length;
        const overallUptime = totalChecks > 0
            ? ((successfulChecks / totalChecks) * 100).toFixed(2)
            : 100;

        // Average response time
        const responseTimes = history
            .filter((h) => h.responseMs)
            .map((h) => h.responseMs);
        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;

        // Recent incidents
        const recentIncidents = monitors
            .filter((m) => m.lastStatus === 'down')
            .map((m) => ({
                monitorId: m._id,
                monitorName: m.name,
                url: m.url,
                error: m.lastError,
                since: m.lastChecked,
            }));

        res.status(200).json({
            success: true,
            stats: {
                totalMonitors,
                activeMonitors,
                upMonitors,
                downMonitors,
                overallUptime: parseFloat(overallUptime),
                avgResponseTime,
                totalChecks24h: totalChecks,
                recentIncidents,
            },
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};
