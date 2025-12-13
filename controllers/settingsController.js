/**
 * Settings Controller
 * User profile, API keys, notifications, and security settings
 */

const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const Session = require('../models/Session');
const SecurityLog = require('../models/SecurityLog');

// @desc    Get user profile
// @route   GET /api/settings/profile
// @access  Private
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -verificationToken -resetToken')
            .populate('teams', 'name slug');

        res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update user profile
// @route   PUT /api/settings/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { name, email, avatar, timezone, language } = req.body;

        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (avatar !== undefined) user.avatar = avatar;
        if (timezone) user.timezone = timezone;
        if (language) user.language = language;

        // If email changed, require re-verification
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email already in use' });
            }
            user.email = email.toLowerCase();
            // In production, you might want to require email re-verification
        }

        await user.save();

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                timezone: user.timezone,
                language: user.language,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Change password
// @route   POST /api/settings/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const user = await User.findById(req.user._id).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        // Log security event
        await SecurityLog.log({
            userId: user._id,
            action: 'password_changed',
            description: 'Password changed successfully',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get API keys
// @route   GET /api/settings/api-keys
// @access  Private
exports.getApiKeys = async (req, res) => {
    try {
        const apiKeys = await ApiKey.find({ userId: req.user._id })
            .select('-keyHash')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, apiKeys });
    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Create API key
// @route   POST /api/settings/api-keys
// @access  Private
exports.createApiKey = async (req, res) => {
    try {
        const { name, permissions, expiresAt, teamId } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        // Verify team membership
        // req.user.teams is populated, so we need to check _id
        const team = req.user.teams.find(t => t._id.toString() === teamId);
        if (!team && teamId) {
            return res.status(400).json({ success: false, message: 'Invalid team' });
        }

        // Generate key
        const { key, keyHash, keyPrefix } = ApiKey.generate();

        const apiKey = await ApiKey.create({
            userId: req.user._id,
            teamId: teamId || req.user.teams[0],
            name,
            keyHash,
            keyPrefix,
            permissions: permissions || {
                monitors: { read: true, write: false },
                incidents: { read: true, write: false },
                statusPages: { read: true, write: false },
                team: { read: false, write: false },
            },
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        // Log security event
        await SecurityLog.log({
            userId: req.user._id,
            teamId: apiKey.teamId,
            action: 'api_key_created',
            description: `API key "${name}" created`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.status(201).json({
            success: true,
            apiKey: {
                id: apiKey._id,
                name: apiKey.name,
                keyPrefix: apiKey.keyPrefix,
                permissions: apiKey.permissions,
                expiresAt: apiKey.expiresAt,
            },
            // Only return the full key once!
            key,
            warning: 'Save this key now. It will not be shown again.',
        });
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Revoke API key
// @route   DELETE /api/settings/api-keys/:id
// @access  Private
exports.revokeApiKey = async (req, res) => {
    try {
        const apiKey = await ApiKey.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isActive: false },
            { new: true }
        );

        if (!apiKey) {
            return res.status(404).json({ success: false, message: 'API key not found' });
        }

        // Log security event
        await SecurityLog.log({
            userId: req.user._id,
            action: 'api_key_revoked',
            description: `API key "${apiKey.name}" revoked`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.status(200).json({ success: true, message: 'API key revoked' });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get active sessions
// @route   GET /api/settings/sessions
// @access  Private
exports.getSessions = async (req, res) => {
    try {
        const sessions = await Session.find({
            userId: req.user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
        }).sort({ lastActiveAt: -1 });

        res.status(200).json({
            success: true,
            sessions: sessions.map(s => ({
                id: s._id,
                deviceInfo: s.deviceInfo,
                ipAddress: s.ipAddress,
                location: s.location,
                lastActiveAt: s.lastActiveAt,
                createdAt: s.createdAt,
                isCurrent: s.token === req.token, // Mark current session
            })),
        });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Revoke session
// @route   DELETE /api/settings/sessions/:id
// @access  Private
exports.revokeSession = async (req, res) => {
    try {
        const session = await Session.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        await session.revoke('user_request');

        // Log security event
        await SecurityLog.log({
            userId: req.user._id,
            action: 'session_revoked',
            description: 'Session revoked',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        res.status(200).json({ success: true, message: 'Session revoked' });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Revoke all other sessions
// @route   POST /api/settings/sessions/revoke-all
// @access  Private
exports.revokeAllSessions = async (req, res) => {
    try {
        await Session.updateMany(
            {
                userId: req.user._id,
                token: { $ne: req.token },
                isRevoked: false,
            },
            {
                isRevoked: true,
                revokedAt: new Date(),
                revokedReason: 'user_request_all',
            }
        );

        // Log security event
        await SecurityLog.log({
            userId: req.user._id,
            action: 'session_revoked',
            description: 'All other sessions revoked',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'warning',
        });

        res.status(200).json({ success: true, message: 'All other sessions revoked' });
    } catch (error) {
        console.error('Revoke all sessions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get security logs
// @route   GET /api/settings/security-logs
// @access  Private
exports.getSecurityLogs = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const logs = await SecurityLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        const total = await SecurityLog.countDocuments({ userId: req.user._id });

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

// @desc    Delete account
// @route   DELETE /api/settings/account
// @access  Private
exports.deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const user = await User.findById(req.user._id).select('+password');

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        // TODO: Clean up user's data (monitors, teams they own, etc.)

        await User.findByIdAndDelete(user._id);

        res.status(200).json({ success: true, message: 'Account deleted' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// @desc    Generate 2FA secret
// @route   POST /api/settings/2fa/generate
// @access  Private
exports.generateTwoFactorSecret = async (req, res) => {
    try {
        const speakeasy = require('speakeasy');
        const qrcode = require('qrcode');

        const secret = speakeasy.generateSecret({
            name: `Balaping (${req.user.email})`,
        });

        const user = await User.findById(req.user._id);
        user.twoFactorSecret = secret.base32;
        await user.save();

        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        res.status(200).json({
            success: true,
            secret: secret.base32,
            qrCodeUrl,
        });
    } catch (error) {
        console.error('Generate 2FA secret error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Verify 2FA token and enable
// @route   POST /api/settings/2fa/verify
// @access  Private
exports.verifyTwoFactor = async (req, res) => {
    try {
        const { token } = req.body;
        const speakeasy = require('speakeasy');

        const user = await User.findById(req.user._id).select('+twoFactorSecret');

        if (!user.twoFactorSecret) {
            return res.status(400).json({ success: false, message: '2FA secret not generated' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
        });

        if (verified) {
            user.twoFactorEnabled = true;
            await user.save();

            // Log security event
            await SecurityLog.log({
                userId: user._id,
                action: '2fa_enabled',
                description: 'Two-factor authentication enabled',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            res.status(200).json({ success: true, message: '2FA enabled successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid token' });
        }
    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Disable 2FA
// @route   POST /api/settings/2fa/disable
// @access  Private
exports.disableTwoFactor = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        // Log security event
        await SecurityLog.log({
            userId: user._id,
            action: '2fa_disabled',
            description: 'Two-factor authentication disabled',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'warning',
        });

        res.status(200).json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
