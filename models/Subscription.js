const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            unique: true,
        },
        // Stripe fields
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        stripePriceId: String,

        // Plan details
        plan: {
            type: String,
            enum: ['free', 'pro', 'enterprise'],
            default: 'free',
        },
        status: {
            type: String,
            enum: ['active', 'canceled', 'past_due', 'trialing', 'inactive'],
            default: 'active',
        },

        // Plan limits
        limits: {
            monitors: { type: Number, default: 5 },         // Free: 5, Pro: 50, Enterprise: unlimited
            teamMembers: { type: Number, default: 1 },      // Free: 1, Pro: 10, Enterprise: unlimited
            checkInterval: { type: Number, default: 300 },  // Minimum interval in seconds (Free: 5min, Pro: 1min, Enterprise: 30s)
            alertChannels: { type: Number, default: 1 },    // Free: 1, Pro: 5, Enterprise: unlimited
            historyRetention: { type: Number, default: 7 }, // Days to keep history
            statusPages: { type: Number, default: 1 },      // Free: 1, Pro: 5, Enterprise: unlimited
        },

        // Usage tracking
        usage: {
            monitors: { type: Number, default: 0 },
            teamMembers: { type: Number, default: 1 },
            alertChannels: { type: Number, default: 0 },
            checksThisMonth: { type: Number, default: 0 },
            alertsSentThisMonth: { type: Number, default: 0 },
        },

        // Billing cycle
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        cancelAtPeriodEnd: {
            type: Boolean,
            default: false,
        },

        // Trial
        trialEndsAt: Date,
    },
    {
        timestamps: true,
    }
);

// Plan configurations
subscriptionSchema.statics.PLANS = {
    free: {
        name: 'Free',
        price: 0,
        limits: {
            monitors: 5,
            teamMembers: 1,
            checkInterval: 300,
            alertChannels: 1,
            historyRetention: 7,
            statusPages: 1,
        },
    },
    pro: {
        name: 'Pro',
        price: 29,
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
        limits: {
            monitors: 50,
            teamMembers: 10,
            checkInterval: 60,
            alertChannels: 5,
            historyRetention: 30,
            statusPages: 5,
        },
    },
    enterprise: {
        name: 'Enterprise',
        price: 99,
        stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly',
        limits: {
            monitors: -1, // unlimited
            teamMembers: -1,
            checkInterval: 30,
            alertChannels: -1,
            historyRetention: 365,
            statusPages: -1,
        },
    },
};

// Check if limit is exceeded
subscriptionSchema.methods.isLimitExceeded = function (resource) {
    const limit = this.limits[resource];
    const usage = this.usage[resource] || 0;
    if (limit === -1) return false; // unlimited
    return usage >= limit;
};

// Get remaining quota
subscriptionSchema.methods.getRemainingQuota = function (resource) {
    const limit = this.limits[resource];
    const usage = this.usage[resource] || 0;
    if (limit === -1) return Infinity;
    return Math.max(0, limit - usage);
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
