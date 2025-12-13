const mongoose = require('mongoose');
const crypto = require('crypto');

const monitorSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Monitor name is required'],
            trim: true,
        },
        // Monitor type
        type: {
            type: String,
            enum: ['http', 'ping', 'port', 'dns', 'keyword', 'heartbeat', 'cronjob'],
            default: 'http',
        },
        // URL/Host (used by http, ping, dns, keyword)
        url: {
            type: String,
            trim: true,
        },
        // HTTP specific
        method: {
            type: String,
            enum: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH'],
            default: 'GET',
        },
        expectedCode: {
            type: Number,
            default: 200,
        },
        headers: {
            type: Object,
            default: {},
        },
        body: {
            type: String,
            default: '',
        },
        // Port check specific
        port: {
            type: Number,
            min: 1,
            max: 65535,
        },
        portProtocol: {
            type: String,
            enum: ['tcp', 'udp'],
            default: 'tcp',
        },
        // DNS check specific
        dnsRecordType: {
            type: String,
            enum: ['A', 'AAAA', 'MX', 'CNAME', 'TXT', 'NS', 'SOA'],
            default: 'A',
        },
        dnsExpectedValue: String,
        // Keyword check specific
        keyword: String,
        keywordType: {
            type: String,
            enum: ['contains', 'not_contains'],
            default: 'contains',
        },
        // Heartbeat monitor specific
        heartbeatToken: {
            type: String,
            unique: true,
            sparse: true,
        },
        heartbeatInterval: {
            type: Number,
            default: 300, // Expected heartbeat every 5 minutes
        },
        lastHeartbeat: Date,
        // Cronjob monitor specific
        cronExpression: String,
        cronGracePeriod: {
            type: Number,
            default: 60, // 60 seconds grace period
        },
        lastCronRun: Date,
        expectedCronRun: Date,
        // Common settings
        intervalSec: {
            type: Number,
            default: 60,
            min: [30, 'Minimum interval is 30 seconds'],
        },
        timeout: {
            type: Number,
            default: 30000, // 30 seconds
            min: 1000,
            max: 120000,
        },
        // SSL certificate monitoring
        sslCheck: {
            type: Boolean,
            default: false,
        },
        sslExpiresAt: Date,
        sslDaysRemaining: Number,
        sslIssuer: String,
        // Multi-region (future)
        regions: [{
            type: String,
            enum: ['us-east', 'us-west', 'eu-west', 'eu-central', 'ap-south', 'ap-east'],
        }],
        // Alert configuration
        alertChannels: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AlertChannel',
        }],
        alertAfterFailures: {
            type: Number,
            default: 1,
        },
        // Status
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
        lastStatus: {
            type: String,
            enum: ['up', 'down', 'degraded', 'pending', null],
            default: 'pending',
        },
        lastChecked: Date,
        lastResponseMs: Number,
        lastError: String,
        consecutiveFailures: {
            type: Number,
            default: 0,
        },
        // Current incident
        currentIncidentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Incident',
        },
        // Stats
        uptimePercentage24h: {
            type: Number,
            default: 100,
        },
        avgResponseTime24h: {
            type: Number,
            default: 0,
        },
        totalChecks: {
            type: Number,
            default: 0,
        },
        // Metadata
        description: String,
        tags: [String],
    },
    {
        timestamps: true,
    }
);

// Generate heartbeat token before save
monitorSchema.pre('save', function (next) {
    if (this.type === 'heartbeat' && !this.heartbeatToken) {
        this.heartbeatToken = crypto.randomBytes(16).toString('hex');
    }
    next();
});

// Virtual for heartbeat URL
monitorSchema.virtual('heartbeatUrl').get(function () {
    if (this.type === 'heartbeat') {
        return `${process.env.API_URL || 'http://localhost:4000'}/api/heartbeat/${this.heartbeatToken}`;
    }
    return null;
});

// Compound indexes
monitorSchema.index({ teamId: 1, active: 1 });
monitorSchema.index({ type: 1, active: 1 });
monitorSchema.index({ heartbeatToken: 1 });
monitorSchema.index({ lastStatus: 1 });

// Include virtuals in JSON
monitorSchema.set('toJSON', { virtuals: true });
monitorSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Monitor', monitorSchema);
