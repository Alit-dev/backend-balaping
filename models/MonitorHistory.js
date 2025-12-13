const mongoose = require('mongoose');

const monitorHistorySchema = new mongoose.Schema(
    {
        monitorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Monitor',
            required: true,
            index: true,
        },
        success: {
            type: Boolean,
            required: true,
        },
        statusCode: Number,
        responseMs: Number,
        error: String,
        checkedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: false,
    }
);

// Compound index for efficient queries
monitorHistorySchema.index({ monitorId: 1, checkedAt: -1 });

// TTL index to auto-delete old records (optional - 30 days retention)
monitorHistorySchema.index({ checkedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('MonitorHistory', monitorHistorySchema);
