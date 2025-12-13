const mongoose = require('mongoose');

const alertChannelSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Channel name is required'],
            trim: true,
        },
        type: {
            type: String,
            enum: ['email', 'telegram', 'webhook'],
            required: true,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        // Configuration based on type
        config: {
            // Email
            emails: [String],

            // Telegram
            telegramBotToken: String,
            telegramChatId: String,

            // Webhook
            webhookUrl: String,
            webhookMethod: {
                type: String,
                enum: ['GET', 'POST'],
                default: 'POST',
            },
            webhookHeaders: {
                type: Map,
                of: String,
            },
        },
        // Alert settings
        notifyOn: {
            down: { type: Boolean, default: true },
            up: { type: Boolean, default: true },
            degraded: { type: Boolean, default: true },
            sslExpiry: { type: Boolean, default: true },
        },
        // Rate limiting
        cooldownMinutes: {
            type: Number,
            default: 5, // Don't send more than 1 alert per 5 minutes per monitor
        },
        lastAlertAt: Date,
        // Stats
        alertsSent: {
            type: Number,
            default: 0,
        },
        lastError: String,
    },
    {
        timestamps: true,
    }
);

// Indexes
alertChannelSchema.index({ teamId: 1, type: 1 });
alertChannelSchema.index({ teamId: 1, enabled: 1 });

module.exports = mongoose.model('AlertChannel', alertChannelSchema);
