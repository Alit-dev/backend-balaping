const Team = require('../models/Team');

// Check if user has access to team
const teamAccess = async (req, res, next) => {
    try {
        const teamId = req.params.teamId || req.body.teamId;

        if (!teamId) {
            return res.status(400).json({
                success: false,
                message: 'Team ID is required',
            });
        }

        const team = await Team.findById(teamId);

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found',
            });
        }

        // Check if user is a member
        const member = team.members.find(
            (m) => m.userId.toString() === req.user._id.toString()
        );

        if (!member) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this team',
            });
        }

        req.team = team;
        req.memberRole = member.role;
        next();
    } catch (error) {
        console.error('Team access error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Check if user is admin or owner
const requireAdmin = (req, res, next) => {
    if (!['owner', 'admin'].includes(req.memberRole)) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
        });
    }
    next();
};

// Check if user is owner
const requireOwner = (req, res, next) => {
    if (req.memberRole !== 'owner') {
        return res.status(403).json({
            success: false,
            message: 'Owner access required',
        });
    }
    next();
};

module.exports = { teamAccess, requireAdmin, requireOwner };
