const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'API key name is required'],
            trim: true,
        },
        // Hashed key (never store plain key)
        keyHash: {
            type: String,
            required: true,
            unique: true,
        },
        // Only show prefix for identification
        keyPrefix: {
            type: String,
            required: true,
        },
        // Permissions
        permissions: {
            monitors: {
                read: { type: Boolean, default: true },
                write: { type: Boolean, default: false },
            },
            incidents: {
                read: { type: Boolean, default: true },
                write: { type: Boolean, default: false },
            },
            statusPages: {
                read: { type: Boolean, default: true },
                write: { type: Boolean, default: false },
            },
            team: {
                read: { type: Boolean, default: false },
                write: { type: Boolean, default: false },
            },
        },
        // Rate limiting
        rateLimit: {
            requestsPerMinute: { type: Number, default: 60 },
            requestsPerHour: { type: Number, default: 1000 },
        },
        // Usage stats
        usage: {
            totalRequests: { type: Number, default: 0 },
            lastUsedAt: Date,
            lastUsedIp: String,
        },
        // Status
        isActive: {
            type: Boolean,
            default: true,
        },
        expiresAt: Date,
    },
    {
        timestamps: true,
    }
);

// Generate API key
apiKeySchema.statics.generate = function () {
    const key = `bp_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPrefix = key.substring(0, 10);
    return { key, keyHash, keyPrefix };
};

// Verify API key
apiKeySchema.statics.verify = async function (key) {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const apiKey = await this.findOne({ keyHash, isActive: true });

    if (!apiKey) return null;
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) return null;

    // Update usage
    apiKey.usage.totalRequests += 1;
    apiKey.usage.lastUsedAt = new Date();
    await apiKey.save();

    return apiKey;
};

// Check permission
apiKeySchema.methods.hasPermission = function (resource, action) {
    return this.permissions[resource]?.[action] === true;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
