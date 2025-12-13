/**
 * Admin Controller
 * Admin panel functionality for system management
 */

const User = require('../models/User');
const Team = require('../models/Team');
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const Subscription = require('../models/Subscription');
const MonitorHistory = require('../models/MonitorHistory');
const SecurityLog = require('../models/SecurityLog');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin only
exports.getDashboardStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalTeams,
            totalMonitors,
            activeMonitors,
            activeIncidents,
            subscriptionStats,
        ] = await Promise.all([
            User.countDocuments(),
            Team.countDocuments(),
            Monitor.countDocuments(),
            Monitor.countDocuments({ active: true }),
            Incident.countDocuments({ status: { $ne: 'resolved' } }),
            getSubscriptionStats(),
        ]);

        // Get recent registrations
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email createdAt verified');

        // Get system health
        const systemHealth = await getSystemHealth();

        res.status(200).json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    recent: recentUsers,
                },
                teams: totalTeams,
                monitors: {
                    total: totalMonitors,
                    active: activeMonitors,
                },
                incidents: {
                    active: activeIncidents,
                },
                subscriptions: subscriptionStats,
                systemHealth,
            },
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin only
exports.getUsers = async (req, res) => {
    try {
        const { search, limit = 50, offset = 0, sort = 'createdAt', order = 'desc' } = req.query;

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(query)
            .populate('teams', 'name slug')
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .select('-verificationToken -resetToken');

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            users,
            total,
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Admin only
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('teams')
            .select('-verificationToken -resetToken');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get user's security logs
        const securityLogs = await SecurityLog.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            user,
            securityLogs,
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update user (admin)
// @route   PUT /api/admin/users/:id
// @access  Admin only
exports.updateUser = async (req, res) => {
    try {
        const { name, email, verified, role } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (typeof verified === 'boolean') user.verified = verified;
        if (role) user.role = role;

        await user.save();

        // Log admin action
        await SecurityLog.log({
            userId: user._id,
            action: 'admin_action',
            description: `User updated by admin`,
            metadata: { updatedBy: req.user._id },
            severity: 'warning',
        });

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete user (admin)
// @route   DELETE /api/admin/users/:id
// @access  Admin only
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Don't allow deleting yourself
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
        }

        await User.findByIdAndDelete(user._id);

        // Log admin action
        await SecurityLog.log({
            action: 'admin_action',
            description: `User ${user.email} deleted by admin`,
            metadata: { deletedBy: req.user._id, deletedUser: user.email },
            severity: 'critical',
        });

        res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all monitors (admin)
// @route   GET /api/admin/monitors
// @access  Admin only
exports.getMonitors = async (req, res) => {
    try {
        const { status, type, limit = 50, offset = 0 } = req.query;

        const query = {};
        if (status) query.lastStatus = status;
        if (type) query.type = type;

        const monitors = await Monitor.find(query)
            .populate('teamId', 'name slug')
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await Monitor.countDocuments(query);

        // Get status breakdown
        const statusBreakdown = await Monitor.aggregate([
            { $group: { _id: '$lastStatus', count: { $sum: 1 } } },
        ]);

        res.status(200).json({
            success: true,
            monitors,
            total,
            statusBreakdown: Object.fromEntries(
                statusBreakdown.map(s => [s._id || 'pending', s.count])
            ),
        });
    } catch (error) {
        console.error('Get monitors error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get global incidents
// @route   GET /api/admin/incidents
// @access  Admin only
exports.getIncidents = async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        const query = {};
        if (status) query.status = status;

        const incidents = await Incident.find(query)
            .populate('teamId', 'name slug')
            .populate('monitorId', 'name url')
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

// @desc    Get system health
// @route   GET /api/admin/system
// @access  Admin only
exports.getSystemHealth = async (req, res) => {
    try {
        const health = await getSystemHealth();
        const queueStats = await getQueueStats();

        res.status(200).json({
            success: true,
            health,
            queue: queueStats,
        });
    } catch (error) {
        console.error('System health error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get billing overview
// @route   GET /api/admin/billing
// @access  Admin only
exports.getBillingOverview = async (req, res) => {
    try {
        const subscriptionStats = await getSubscriptionStats();

        const subscriptions = await Subscription.find()
            .populate('teamId', 'name slug')
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            stats: subscriptionStats,
            subscriptions,
        });
    } catch (error) {
        console.error('Billing overview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get security logs
// @route   GET /api/admin/security-logs
// @access  Admin only
exports.getSecurityLogs = async (req, res) => {
    try {
        const { action, severity, limit = 100, offset = 0 } = req.query;

        const query = {};
        if (action) query.action = action;
        if (severity) query.severity = severity;

        const logs = await SecurityLog.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await SecurityLog.countDocuments(query);

        res.status(200).json({
            success: true,
            logs,
            total,
        });
    } catch (error) {
        console.error('Get security logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Helper functions
async function getSubscriptionStats() {
    const stats = await Subscription.aggregate([
        {
            $group: {
                _id: '$plan',
                count: { $sum: 1 },
            },
        },
    ]);

    return {
        free: stats.find(s => s._id === 'free')?.count || 0,
        pro: stats.find(s => s._id === 'pro')?.count || 0,
        enterprise: stats.find(s => s._id === 'enterprise')?.count || 0,
    };
}

async function getSystemHealth() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    // Check recent check activity
    const recentChecks = await MonitorHistory.countDocuments({
        checkedAt: { $gte: fiveMinutesAgo },
    });

    // Get database stats
    const dbStats = {
        users: await User.countDocuments(),
        monitors: await Monitor.countDocuments(),
        checksLast5Min: recentChecks,
    };

    // Memory usage
    const memoryUsage = process.memoryUsage();

    return {
        status: recentChecks > 0 ? 'healthy' : 'degraded',
        database: dbStats,
        memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        },
        uptime: Math.round(process.uptime()) + ' seconds',
        nodeVersion: process.version,
    };
}

async function getQueueStats() {
    try {
        const { getQueueStats } = require('../config/queue');
        return await getQueueStats();
    } catch {
        return { error: 'Queue not available' };
    }
}
