const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            index: true,
        },
        monitorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Monitor',
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Incident title is required'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['investigating', 'identified', 'monitoring', 'resolved'],
            default: 'investigating',
        },
        severity: {
            type: String,
            enum: ['minor', 'major', 'critical'],
            default: 'major',
        },
        type: {
            type: String,
            enum: ['auto', 'manual'],
            default: 'auto',
        },
        timeline: [
            {
                status: {
                    type: String,
                    enum: ['investigating', 'identified', 'monitoring', 'resolved'],
                },
                message: String,
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
            },
        ],
        startedAt: {
            type: Date,
            default: Date.now,
        },
        resolvedAt: Date,
        // Duration in milliseconds
        duration: Number,
        // Affected services for status page
        affectedServices: [String],
        // Notify subscribers when created/updated
        notifySubscribers: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Calculate duration when resolved
incidentSchema.pre('save', function (next) {
    if (this.status === 'resolved' && !this.resolvedAt) {
        this.resolvedAt = new Date();
        this.duration = this.resolvedAt - this.startedAt;
    }
    next();
});

// Indexes
incidentSchema.index({ teamId: 1, status: 1 });
incidentSchema.index({ teamId: 1, createdAt: -1 });
incidentSchema.index({ monitorId: 1, createdAt: -1 });

module.exports = mongoose.model('Incident', incidentSchema);
