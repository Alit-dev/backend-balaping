const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            index: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                // Auth
                'login_success',
                'login_failed',
                'logout',
                'password_changed',
                'password_reset_requested',
                'password_reset_completed',
                'email_verified',
                'session_revoked',

                // API Keys
                'api_key_created',
                'api_key_revoked',
                'api_key_used',

                // Team
                'team_created',
                'team_member_invited',
                'team_member_joined',
                'team_member_removed',
                'team_member_role_changed',

                // Billing
                'subscription_created',
                'subscription_upgraded',
                'subscription_downgraded',
                'subscription_canceled',
                'payment_succeeded',
                'payment_failed',

                // Monitor
                'monitor_created',
                'monitor_deleted',
                'monitor_paused',

                // Admin
                'admin_action',
            ],
        },
        description: String,
        metadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
        },
        ipAddress: String,
        userAgent: String,
        location: {
            country: String,
            city: String,
        },
        severity: {
            type: String,
            enum: ['info', 'warning', 'critical'],
            default: 'info',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
securityLogSchema.index({ userId: 1, createdAt: -1 });
securityLogSchema.index({ teamId: 1, createdAt: -1 });
securityLogSchema.index({ action: 1, createdAt: -1 });
securityLogSchema.index({ severity: 1, createdAt: -1 });

// TTL - keep logs for 90 days
securityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Helper to create log
securityLogSchema.statics.log = async function (data) {
    return await this.create(data);
};

module.exports = mongoose.model('SecurityLog', securityLogSchema);
