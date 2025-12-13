const mongoose = require('mongoose');

const statusPageSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Status page name is required'],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        // Custom domain (Pro/Enterprise)
        customDomain: {
            domain: String,
            verified: { type: Boolean, default: false },
            verificationToken: String,
            sslEnabled: { type: Boolean, default: false },
        },
        // Branding
        branding: {
            logo: String, // URL to logo
            favicon: String,
            primaryColor: { type: String, default: '#4F6DF5' },
            backgroundColor: { type: String, default: '#FFFFFF' },
        },
        // Page content
        header: {
            title: String,
            description: String,
        },
        footer: {
            text: String,
            links: [
                {
                    label: String,
                    url: String,
                },
            ],
        },
        // Monitors to show
        monitors: [
            {
                monitorId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Monitor',
                },
                displayName: String, // Override monitor name
                description: String,
                order: Number,
            },
        ],
        // Visibility
        isPublic: {
            type: Boolean,
            default: true,
        },
        // Password protection (Enterprise)
        passwordProtected: {
            type: Boolean,
            default: false,
        },
        password: String, // Hashed
        // Subscribers (email notifications for status changes)
        subscribers: [
            {
                email: {
                    type: String,
                    lowercase: true,
                },
                verified: { type: Boolean, default: false },
                verificationToken: String,
                subscribedAt: { type: Date, default: Date.now },
            },
        ],
        // Show/hide sections
        showIncidents: { type: Boolean, default: true },
        showUptime: { type: Boolean, default: true },
        showResponseTime: { type: Boolean, default: true },
        showSubscribe: { type: Boolean, default: true },
        // Uptime display period
        uptimeDays: { type: Number, default: 90 },
    },
    {
        timestamps: true,
    }
);

// Generate verification token for custom domain
statusPageSchema.methods.generateDomainVerificationToken = function () {
    const crypto = require('crypto');
    this.customDomain.verificationToken = crypto.randomBytes(16).toString('hex');
    return this.customDomain.verificationToken;
};

// Add subscriber
statusPageSchema.methods.addSubscriber = async function (email) {
    const crypto = require('crypto');
    const existing = this.subscribers.find((s) => s.email === email.toLowerCase());
    if (existing) {
        if (existing.verified) {
            throw new Error('Email already subscribed');
        }
        // Resend verification
        existing.verificationToken = crypto.randomBytes(32).toString('hex');
        await this.save();
        return existing.verificationToken;
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.subscribers.push({
        email: email.toLowerCase(),
        verificationToken: token,
    });
    await this.save();
    return token;
};

// Verify subscriber
statusPageSchema.methods.verifySubscriber = async function (token) {
    const subscriber = this.subscribers.find((s) => s.verificationToken === token);
    if (!subscriber) {
        throw new Error('Invalid verification token');
    }
    subscriber.verified = true;
    subscriber.verificationToken = undefined;
    await this.save();
    return true;
};

// Indexes
statusPageSchema.index({ slug: 1 }, { unique: true });
statusPageSchema.index({ 'customDomain.domain': 1 });

module.exports = mongoose.model('StatusPage', statusPageSchema);
