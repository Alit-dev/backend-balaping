const crypto = require('crypto');
const User = require('../models/User');
const Team = require('../models/Team');
const Session = require('../models/Session');
const { generateToken } = require('../middleware/auth');
const {
    sendVerificationEmail,
    sendResetPasswordEmail,
} = require('../utils/email');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, password, and name',
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
            });
        }

        // Create user
        const user = new User({
            email: email.toLowerCase(),
            password,
            name,
        });

        // Generate verification token
        const verificationToken = user.generateVerificationToken();
        await user.save();

        // Send verification email
        await sendVerificationEmail(user.email, user.name, verificationToken);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            verificationToken: hashedToken,
            verificationTokenExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token',
            });
        }

        // Verify user
        user.verified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiry = undefined;
        await user.save();

        // Create default team for user
        const team = new Team({
            name: `${user.name}'s Team`,
            owner: user._id,
            members: [{ userId: user._id, role: 'owner' }],
        });
        await team.save();

        // Add team to user
        user.teams.push(team._id);
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Create session
        await createSession(user._id, token, req);

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                teams: [team],
            },
        });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password',
            });
        }

        // Find user with password
        const user = await User.findOne({ email: email.toLowerCase() })
            .select('+password')
            .populate('teams');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Check if verified
        if (!user.verified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email first',
            });
        }

        // Generate token
        const token = generateToken(user._id);

        // Create session
        await createSession(user._id, token, req);

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                teams: user.teams,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('teams');

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                teams: user.teams,
            },
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if email exists
            return res.status(200).json({
                success: true,
                message: 'If your email is registered, you will receive a password reset link',
            });
        }

        // Generate reset token
        const resetToken = user.generateResetToken();
        await user.save();

        // Send reset email
        await sendResetPasswordEmail(user.email, user.name, resetToken);

        res.status(200).json({
            success: true,
            message: 'If your email is registered, you will receive a password reset link',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            resetToken: hashedToken,
            resetTokenExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token',
            });
        }

        // Set new password
        user.password = password;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successful',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || user.verified) {
            return res.status(200).json({
                success: true,
                message: 'If your email is registered and unverified, you will receive a verification link',
            });
        }

        // Generate new verification token
        const verificationToken = user.generateVerificationToken();
        await user.save();

        // Send verification email
        await sendVerificationEmail(user.email, user.name, verificationToken);

        res.status(200).json({
            success: true,
            message: 'If your email is registered and unverified, you will receive a verification link',
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Get active sessions
// @route   GET /api/auth/sessions
// @access  Private
exports.getSessions = async (req, res) => {
    try {
        const sessions = await Session.find({
            userId: req.user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
        }).sort({ lastActiveAt: -1 });

        // Map to safe response
        const safeSessions = sessions.map(session => ({
            id: session._id,
            device: session.deviceInfo.device,
            browser: session.deviceInfo.browser,
            os: session.deviceInfo.os,
            location: session.location ? `${session.location.city}, ${session.location.country}` : 'Unknown Location',
            ipAddress: session.ipAddress,
            lastActive: session.lastActiveAt,
            current: session.token === req.token, // Assuming middleware attaches token to req
        }));

        res.status(200).json({
            success: true,
            sessions: safeSessions,
        });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// @desc    Revoke session
// @route   DELETE /api/auth/sessions/:id
// @access  Private
exports.revokeSession = async (req, res) => {
    try {
        const session = await Session.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found',
            });
        }

        await session.revoke('user_revoked');

        res.status(200).json({
            success: true,
            message: 'Session revoked successfully',
        });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};
// Helper to create session
const createSession = async (userId, token, req) => {
    try {
        const userAgent = req.headers['user-agent'] || '';
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Simple UA parsing
        let browser = 'Unknown';
        let os = 'Unknown';
        let device = 'Desktop';

        if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';

        if (userAgent.includes('Windows')) os = 'Windows';
        else if (userAgent.includes('Mac')) os = 'macOS';
        else if (userAgent.includes('Linux')) os = 'Linux';
        else if (userAgent.includes('Android')) { os = 'Android'; device = 'Mobile'; }
        else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) { os = 'iOS'; device = 'Mobile'; }

        // Calculate expiry (7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await Session.create({
            userId,
            token,
            deviceInfo: {
                userAgent,
                browser,
                os,
                device,
            },
            ipAddress,
            expiresAt,
        });
    } catch (error) {
        console.error('Create session error:', error);
        // Don't fail login if session creation fails
    }
};
