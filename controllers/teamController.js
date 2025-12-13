const crypto = require('crypto');
const Team = require('../models/Team');
const User = require('../models/User');
const { sendTeamInviteEmail } = require('../utils/email');

// @desc    Create new team
// @route   POST /api/teams
// @access  Private
exports.createTeam = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Team name is required',
            });
        }

        const team = new Team({
            name,
            owner: req.user._id,
            members: [{ userId: req.user._id, role: 'owner' }],
        });

        await team.save();

        // Add team to user
        req.user.teams.push(team._id);
        await req.user.save();

        res.status(201).json({
            success: true,
            team,
        });
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get user's teams
// @route   GET /api/teams
// @access  Private
exports.getTeams = async (req, res) => {
    try {
        const teams = await Team.find({
            'members.userId': req.user._id,
        }).populate('members.userId', 'name email');

        res.status(200).json({
            success: true,
            teams,
        });
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get single team
// @route   GET /api/teams/:teamId
// @access  Private
exports.getTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId)
            .populate('members.userId', 'name email')
            .populate('owner', 'name email');

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found',
            });
        }

        // Check access
        const isMember = team.members.some(
            (m) => m.userId._id.toString() === req.user._id.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this team',
            });
        }

        res.status(200).json({
            success: true,
            team,
        });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Update team
// @route   PUT /api/teams/:teamId
// @access  Private (Admin+)
exports.updateTeam = async (req, res) => {
    try {
        const { name } = req.body;

        const team = req.team;
        if (name) team.name = name;

        await team.save();

        res.status(200).json({
            success: true,
            team,
        });
    } catch (error) {
        console.error('Update team error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Invite member to team
// @route   POST /api/teams/:teamId/invite
// @access  Private (Admin+)
exports.inviteMember = async (req, res) => {
    try {
        const { email, role = 'member' } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
            });
        }

        if (!['admin', 'member'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role',
            });
        }

        const team = req.team;

        // Check if already a member
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            const isMember = team.members.some(
                (m) => m.userId.toString() === existingUser._id.toString()
            );
            if (isMember) {
                return res.status(400).json({
                    success: false,
                    message: 'User is already a member',
                });
            }
        }

        // Check if already invited
        const existingInvite = team.invitations.find(
            (inv) => inv.email === email.toLowerCase()
        );
        if (existingInvite) {
            return res.status(400).json({
                success: false,
                message: 'Invitation already sent',
            });
        }

        // Generate invite token
        const inviteToken = team.generateInviteToken(email, role);
        await team.save();

        // Send invitation email
        await sendTeamInviteEmail(email, team.name, req.user.name, inviteToken);

        res.status(200).json({
            success: true,
            message: 'Invitation sent',
        });
    } catch (error) {
        console.error('Invite member error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Accept team invitation
// @route   POST /api/teams/accept-invite/:token
// @access  Private
exports.acceptInvite = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const team = await Team.findOne({
            'invitations.token': hashedToken,
            'invitations.expiresAt': { $gt: Date.now() },
        });

        if (!team) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired invitation',
            });
        }

        const invitation = team.invitations.find(
            (inv) => inv.token === hashedToken
        );

        // Check if email matches
        if (invitation.email !== req.user.email) {
            return res.status(400).json({
                success: false,
                message: 'This invitation was sent to a different email',
            });
        }

        // Add member to team
        team.members.push({
            userId: req.user._id,
            role: invitation.role,
        });

        // Remove invitation
        team.invitations = team.invitations.filter(
            (inv) => inv.token !== hashedToken
        );

        await team.save();

        // Add team to user
        req.user.teams.push(team._id);
        await req.user.save();

        res.status(200).json({
            success: true,
            message: 'Joined team successfully',
            team,
        });
    } catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Update member role
// @route   PUT /api/teams/:teamId/members/:userId
// @access  Private (Owner only)
exports.updateMemberRole = async (req, res) => {
    try {
        const { role } = req.body;
        const { userId } = req.params;

        if (!['admin', 'member'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role',
            });
        }

        const team = req.team;

        // Can't change owner role
        if (userId === team.owner.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change owner role',
            });
        }

        const memberIndex = team.members.findIndex(
            (m) => m.userId.toString() === userId
        );

        if (memberIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Member not found',
            });
        }

        team.members[memberIndex].role = role;
        await team.save();

        res.status(200).json({
            success: true,
            message: 'Role updated',
        });
    } catch (error) {
        console.error('Update member role error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Remove member from team
// @route   DELETE /api/teams/:teamId/members/:userId
// @access  Private (Admin+)
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.params;
        const team = req.team;

        // Can't remove owner
        if (userId === team.owner.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove team owner',
            });
        }

        // Check if member exists
        const memberIndex = team.members.findIndex(
            (m) => m.userId.toString() === userId
        );

        if (memberIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Member not found',
            });
        }

        // Remove member
        team.members.splice(memberIndex, 1);
        await team.save();

        // Remove team from user
        await User.findByIdAndUpdate(userId, {
            $pull: { teams: team._id },
        });

        res.status(200).json({
            success: true,
            message: 'Member removed',
        });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Leave team
// @route   POST /api/teams/:teamId/leave
// @access  Private
exports.leaveTeam = async (req, res) => {
    try {
        const team = req.team;

        // Owner can't leave
        if (req.user._id.toString() === team.owner.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Owner cannot leave team. Transfer ownership first.',
            });
        }

        // Remove member
        team.members = team.members.filter(
            (m) => m.userId.toString() !== req.user._id.toString()
        );
        await team.save();

        // Remove team from user
        req.user.teams = req.user.teams.filter(
            (t) => t.toString() !== team._id.toString()
        );
        await req.user.save();

        res.status(200).json({
            success: true,
            message: 'Left team successfully',
        });
    } catch (error) {
        console.error('Leave team error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};
