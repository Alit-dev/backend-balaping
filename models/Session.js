const mongoose = require('mongoose');
const crypto = require('crypto');

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        deviceInfo: {
            userAgent: String,
            browser: String,
            os: String,
            device: String,
        },
        ipAddress: String,
        location: {
            country: String,
            city: String,
        },
        lastActiveAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        isRevoked: {
            type: Boolean,
            default: false,
        },
        revokedAt: Date,
        revokedReason: String,
    },
    {
        timestamps: true,
    }
);

// Generate session token
sessionSchema.statics.generateToken = function () {
    return crypto.randomBytes(64).toString('hex');
};

// Check if session is valid
sessionSchema.methods.isValid = function () {
    if (this.isRevoked) return false;
    if (new Date() > this.expiresAt) return false;
    return true;
};

// Update last active
sessionSchema.methods.touch = function () {
    this.lastActiveAt = new Date();
    return this.save();
};

// Revoke session
sessionSchema.methods.revoke = function (reason = 'manual') {
    this.isRevoked = true;
    this.revokedAt = new Date();
    this.revokedReason = reason;
    return this.save();
};

// TTL index for automatic cleanup
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, isRevoked: 1 });

module.exports = mongoose.model('Session', sessionSchema);
