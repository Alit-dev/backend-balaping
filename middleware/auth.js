const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');
const ApiKey = require('../models/ApiKey');

// Protect routes - require authentication
const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Check for API key
        if (!token && req.headers['x-api-key']) {
            return await authenticateWithApiKey(req, res, next);
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, no token provided',
            });
        }

        // Store token for session tracking
        req.token = token;

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).populate('teams');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Not authorized, invalid token',
        });
    }
};

// Authenticate with API key
const authenticateWithApiKey = async (req, res, next) => {
    try {
        const apiKeyValue = req.headers['x-api-key'];

        const apiKey = await ApiKey.verify(apiKeyValue);

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key',
            });
        }

        // Get user
        const user = await User.findById(apiKey.userId).populate('teams');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        req.user = user;
        req.apiKey = apiKey;
        req.isApiKeyAuth = true;

        // Update API key last used
        apiKey.usage.lastUsedIp = req.ip;
        await apiKey.save();

        next();
    } catch (error) {
        console.error('API key auth error:', error.message);
        return res.status(401).json({
            success: false,
            message: 'API key authentication failed',
        });
    }
};

// Check team access
const checkTeamAccess = async (req, res, next) => {
    try {
        const teamId = req.params.teamId;

        if (!teamId) {
            return res.status(400).json({
                success: false,
                message: 'Team ID is required',
            });
        }

        // Check if user is a member of the team
        const team = await Team.findById(teamId);

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found',
            });
        }

        const isMember = team.members.some(
            (m) => m.userId.toString() === req.user._id.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this team',
            });
        }

        // Find user's role in team
        const member = team.members.find(
            (m) => m.userId.toString() === req.user._id.toString()
        );

        req.team = team;
        req.teamRole = member.role;

        next();
    } catch (error) {
        console.error('Team access error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Check if user is admin (team admin or owner)
const checkTeamAdmin = (req, res, next) => {
    if (!['owner', 'admin'].includes(req.teamRole)) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
        });
    }
    next();
};

// Check if user is system admin
const isAdmin = async (req, res, next) => {
    try {
        // Check if user has admin role (you can set this in the User model)
        // For now, we'll use email or a dedicated admin flag
        const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

        if (!adminEmails.includes(req.user.email) && !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required',
            });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// Rate limiting middleware
const rateLimit = (limit, windowMs) => {
    const requests = new Map();

    return (req, res, next) => {
        const key = req.ip || 'unknown';
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get existing requests for this key
        let userRequests = requests.get(key) || [];

        // Filter to only requests within the window
        userRequests = userRequests.filter(time => time > windowStart);

        if (userRequests.length >= limit) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later',
            });
        }

        userRequests.push(now);
        requests.set(key, userRequests);

        next();
    };
};

module.exports = {
    protect,
    checkTeamAccess,
    checkTeamAdmin,
    isAdmin,
    generateToken,
    rateLimit,
};
