const Team = require('../models/Team');
const Monitor = require('../models/Monitor');
const MonitorHistory = require('../models/MonitorHistory');

// @desc    Get public status page data
// @route   GET /api/status/:teamSlug
// @access  Public
exports.getStatusPage = async (req, res) => {
    try {
        const team = await Team.findOne({ slug: req.params.teamSlug });

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Status page not found',
            });
        }

        // Get active monitors
        const monitors = await Monitor.find({
            teamId: team._id,
            active: true,
        }).select('name url lastStatus lastChecked lastResponseMs');

        // Calculate uptime for each monitor (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const monitorsWithUptime = await Promise.all(
            monitors.map(async (monitor) => {
                const history = await MonitorHistory.find({
                    monitorId: monitor._id,
                    checkedAt: { $gte: yesterday },
                });

                const totalChecks = history.length;
                const successfulChecks = history.filter((h) => h.success).length;
                const uptimePercentage = totalChecks > 0
                    ? ((successfulChecks / totalChecks) * 100).toFixed(2)
                    : 100;

                return {
                    id: monitor._id,
                    name: monitor.name,
                    url: monitor.url,
                    status: monitor.lastStatus,
                    lastChecked: monitor.lastChecked,
                    responseTime: monitor.lastResponseMs,
                    uptime24h: parseFloat(uptimePercentage),
                };
            })
        );

        // Calculate overall status
        const allUp = monitorsWithUptime.every((m) => m.status === 'up');
        const someDown = monitorsWithUptime.some((m) => m.status === 'down');
        const overallStatus = someDown ? 'down' : allUp ? 'up' : 'degraded';

        res.status(200).json({
            success: true,
            statusPage: {
                team: {
                    name: team.name,
                    slug: team.slug,
                },
                overallStatus,
                monitors: monitorsWithUptime,
                lastUpdated: new Date(),
            },
        });
    } catch (error) {
        console.error('Get status page error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get status page uptime history (last 90 days)
// @route   GET /api/status/:teamSlug/history
// @access  Public
exports.getStatusPageHistory = async (req, res) => {
    try {
        const team = await Team.findOne({ slug: req.params.teamSlug });

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Status page not found',
            });
        }

        const monitors = await Monitor.find({
            teamId: team._id,
            active: true,
        }).select('name');

        // Get daily uptime for last 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const dailyStats = await MonitorHistory.aggregate([
            {
                $match: {
                    monitorId: { $in: monitors.map((m) => m._id) },
                    checkedAt: { $gte: ninetyDaysAgo },
                },
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$checkedAt' } },
                    },
                    totalChecks: { $sum: 1 },
                    successfulChecks: { $sum: { $cond: ['$success', 1, 0] } },
                },
            },
            {
                $project: {
                    date: '$_id.date',
                    uptime: {
                        $multiply: [{ $divide: ['$successfulChecks', '$totalChecks'] }, 100],
                    },
                },
            },
            { $sort: { date: 1 } },
        ]);

        res.status(200).json({
            success: true,
            history: dailyStats.map((d) => ({
                date: d.date,
                uptime: parseFloat(d.uptime.toFixed(2)),
            })),
        });
    } catch (error) {
        console.error('Get status page history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};
