/**
 * Report Controller
 * Generates monitoring reports
 */

const Monitor = require('../models/Monitor');
const MonitorHistory = require('../models/MonitorHistory');
const Incident = require('../models/Incident');

// @desc    Generate report
// @route   GET /api/teams/:teamId/reports
// @access  Private
exports.generateReport = async (req, res) => {
    try {
        const { startDate, endDate, monitorIds, type = 'summary' } = req.query;
        const teamId = req.params.teamId;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Build monitor query
        const monitorQuery = { teamId };
        if (monitorIds) {
            monitorQuery._id = { $in: monitorIds.split(',') };
        }

        const monitors = await Monitor.find(monitorQuery).select('name url type');

        // Aggregate stats for each monitor
        const monitorStats = await Promise.all(monitors.map(async (monitor) => {
            const history = await MonitorHistory.find({
                monitorId: monitor._id,
                checkedAt: { $gte: start, $lte: end }
            });

            const totalChecks = history.length;
            const successChecks = history.filter(h => h.success).length;
            const uptime = totalChecks > 0 ? (successChecks / totalChecks) * 100 : 0;

            const responseTimes = history.filter(h => h.responseMs).map(h => h.responseMs);
            const avgResponseTime = responseTimes.length > 0
                ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                : 0;

            const incidents = await Incident.countDocuments({
                monitorId: monitor._id,
                startedAt: { $gte: start, $lte: end }
            });

            return {
                id: monitor._id,
                name: monitor.name,
                url: monitor.url,
                uptime: parseFloat(uptime.toFixed(2)),
                avgResponseTime: Math.round(avgResponseTime),
                incidents,
                totalChecks
            };
        }));

        // Calculate global summary
        const totalMonitors = monitorStats.length;
        const avgUptime = totalMonitors > 0
            ? monitorStats.reduce((acc, curr) => acc + curr.uptime, 0) / totalMonitors
            : 0;
        const totalIncidents = monitorStats.reduce((acc, curr) => acc + curr.incidents, 0);
        const globalAvgResponse = totalMonitors > 0
            ? monitorStats.reduce((acc, curr) => acc + curr.avgResponseTime, 0) / totalMonitors
            : 0;

        res.json({
            success: true,
            report: {
                type,
                dateRange: { start, end },
                summary: {
                    monitorsTracked: totalMonitors,
                    averageUptime: parseFloat(avgUptime.toFixed(2)),
                    totalIncidents,
                    averageResponseTime: Math.round(globalAvgResponse)
                },
                monitors: monitorStats
            }
        });
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
};

// @desc    Download report as CSV
// @route   GET /api/teams/:teamId/reports/download
// @access  Private
exports.downloadReport = async (req, res) => {
    try {
        const { startDate, endDate, monitorIds } = req.query;
        const teamId = req.params.teamId;

        // Reuse logic to get stats (refactor later for DRY if needed)
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const monitorQuery = { teamId };
        if (monitorIds) {
            monitorQuery._id = { $in: monitorIds.split(',') };
        }

        const monitors = await Monitor.find(monitorQuery).select('name url type');

        const monitorStats = await Promise.all(monitors.map(async (monitor) => {
            const history = await MonitorHistory.find({
                monitorId: monitor._id,
                checkedAt: { $gte: start, $lte: end }
            });

            const totalChecks = history.length;
            const successChecks = history.filter(h => h.success).length;
            const uptime = totalChecks > 0 ? (successChecks / totalChecks) * 100 : 0;

            const responseTimes = history.filter(h => h.responseMs).map(h => h.responseMs);
            const avgResponseTime = responseTimes.length > 0
                ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                : 0;

            const incidents = await Incident.countDocuments({
                monitorId: monitor._id,
                startedAt: { $gte: start, $lte: end }
            });

            return {
                name: monitor.name,
                url: monitor.url,
                uptime: uptime.toFixed(2),
                avgResponseTime: Math.round(avgResponseTime),
                incidents,
                totalChecks
            };
        }));

        // Generate CSV
        const fields = ['Name', 'URL', 'Uptime (%)', 'Avg Response (ms)', 'Incidents', 'Total Checks'];
        let csv = fields.join(',') + '\n';

        monitorStats.forEach(stat => {
            csv += `"${stat.name}","${stat.url}",${stat.uptime},${stat.avgResponseTime},${stat.incidents},${stat.totalChecks}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`);
        res.status(200).send(csv);

    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ success: false, message: 'Failed to download report' });
    }
};

// @desc    Schedule report (Placeholder)
// @route   POST /api/teams/:teamId/reports/schedule
// @access  Private
exports.scheduleReport = async (req, res) => {
    try {
        const { frequency, recipients, monitorIds, type } = req.body;

        // Placeholder - would save to database
        res.json({
            success: true,
            message: 'Report scheduled successfully',
            schedule: {
                id: Date.now().toString(),
                frequency,
                recipients,
                monitors: monitorIds,
                type,
                nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
    } catch (error) {
        console.error('Schedule report error:', error);
        res.status(500).json({ success: false, message: 'Failed to schedule report' });
    }
};
