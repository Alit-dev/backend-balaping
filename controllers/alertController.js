/**
 * Alert Channel Controller
 * Manages alert configurations (Email, Telegram, Webhook)
 */

const AlertChannel = require('../models/AlertChannel');
const alertService = require('../services/alerts');

// @desc    Get all alert channels for team
// @route   GET /api/teams/:teamId/alerts
// @access  Private
exports.getAlertChannels = async (req, res) => {
    try {
        const channels = await AlertChannel.find({ teamId: req.params.teamId })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, channels });
    } catch (error) {
        console.error('Get channels error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get single alert channel
// @route   GET /api/teams/:teamId/alerts/:id
// @access  Private
exports.getAlertChannel = async (req, res) => {
    try {
        const channel = await AlertChannel.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!channel) {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }

        res.status(200).json({ success: true, channel });
    } catch (error) {
        console.error('Get channel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Create alert channel
// @route   POST /api/teams/:teamId/alerts
// @access  Private
exports.createAlertChannel = async (req, res) => {
    try {
        const {
            name,
            type,
            config,
            notifyOn = { down: true, up: true, degraded: true, sslExpiry: true },
            cooldownMinutes = 5,
        } = req.body;

        if (!name || !type) {
            return res.status(400).json({ success: false, message: 'Name and type are required' });
        }

        // Validate config based on type
        const validationError = validateChannelConfig(type, config);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const channel = await AlertChannel.create({
            teamId: req.params.teamId,
            name,
            type,
            config,
            notifyOn,
            cooldownMinutes,
        });

        res.status(201).json({ success: true, channel });
    } catch (error) {
        console.error('Create channel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update alert channel
// @route   PUT /api/teams/:teamId/alerts/:id
// @access  Private
exports.updateAlertChannel = async (req, res) => {
    try {
        const { name, config, enabled, notifyOn, cooldownMinutes } = req.body;

        const channel = await AlertChannel.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!channel) {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }

        // Validate config if provided
        if (config) {
            const validationError = validateChannelConfig(channel.type, config);
            if (validationError) {
                return res.status(400).json({ success: false, message: validationError });
            }
            channel.config = { ...channel.config, ...config };
        }

        if (name) channel.name = name;
        if (typeof enabled === 'boolean') channel.enabled = enabled;
        if (notifyOn) channel.notifyOn = { ...channel.notifyOn, ...notifyOn };
        if (cooldownMinutes) channel.cooldownMinutes = cooldownMinutes;

        await channel.save();

        res.status(200).json({ success: true, channel });
    } catch (error) {
        console.error('Update channel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete alert channel
// @route   DELETE /api/teams/:teamId/alerts/:id
// @access  Private
exports.deleteAlertChannel = async (req, res) => {
    try {
        const channel = await AlertChannel.findOneAndDelete({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!channel) {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }

        res.status(200).json({ success: true, message: 'Channel deleted' });
    } catch (error) {
        console.error('Delete channel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Test alert channel
// @route   POST /api/teams/:teamId/alerts/:id/test
// @access  Private
exports.testAlertChannel = async (req, res) => {
    try {
        const channel = await AlertChannel.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!channel) {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }

        const result = await alertService.testChannel(channel);

        res.status(200).json({
            success: true,
            message: 'Test sent successfully',
            result,
        });
    } catch (error) {
        console.error('Test channel error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Test failed',
        });
    }
};

// @desc    Toggle channel enabled status
// @route   POST /api/teams/:teamId/alerts/:id/toggle
// @access  Private
exports.toggleAlertChannel = async (req, res) => {
    try {
        const channel = await AlertChannel.findOne({
            _id: req.params.id,
            teamId: req.params.teamId,
        });

        if (!channel) {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }

        channel.enabled = !channel.enabled;
        await channel.save();

        res.status(200).json({
            success: true,
            enabled: channel.enabled,
            message: `Channel ${channel.enabled ? 'enabled' : 'disabled'}`,
        });
    } catch (error) {
        console.error('Toggle channel error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Validate channel configuration
 */
function validateChannelConfig(type, config) {
    if (!config) return 'Configuration is required';

    switch (type) {
        case 'email':
            if (!config.emails || !Array.isArray(config.emails) || config.emails.length === 0) {
                return 'At least one email address is required';
            }
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            for (const email of config.emails) {
                if (!emailRegex.test(email)) {
                    return `Invalid email address: ${email}`;
                }
            }
            break;

        case 'telegram':
            if (!config.telegramBotToken) {
                return 'Telegram Bot Token is required';
            }
            if (!config.telegramChatId) {
                return 'Telegram Chat ID is required';
            }
            break;

        case 'webhook':
            if (!config.webhookUrl) {
                return 'Webhook URL is required';
            }
            try {
                new URL(config.webhookUrl);
            } catch {
                return 'Invalid webhook URL';
            }
            break;

        case 'slack':
            if (!config.webhookUrl) {
                return 'Slack Webhook URL is required';
            }
            if (!config.webhookUrl.includes('hooks.slack.com')) {
                return 'Invalid Slack Webhook URL';
            }
            break;

        case 'discord':
            if (!config.webhookUrl) {
                return 'Discord Webhook URL is required';
            }
            if (!config.webhookUrl.includes('discord.com/api/webhooks') && !config.webhookUrl.includes('discordapp.com/api/webhooks')) {
                return 'Invalid Discord Webhook URL';
            }
            break;

        default:
            return `Unknown channel type: ${type}`;
    }

    return null;
}
