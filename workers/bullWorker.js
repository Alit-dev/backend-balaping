/**
 * Monitor Worker - BullMQ Edition
 * Processes monitor check jobs from the queue
 */

const { Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const { QUEUES, addMonitorCheckJob, addAlertJob, addIncidentJob } = require('../config/queue');
const { performCheck } = require('./checks');
const Monitor = require('../models/Monitor');
const MonitorHistory = require('../models/MonitorHistory');
const Incident = require('../models/Incident');
const Team = require('../models/Team');

// Track active workers for graceful shutdown
let monitorWorker = null;
let alertWorker = null;

/**
 * Initialize all workers
 */
async function initializeWorkers() {
    console.log('\n🚀 Initializing BullMQ workers...\n');

    // Monitor check worker
    monitorWorker = new Worker(
        QUEUES.MONITOR_CHECKS,
        async (job) => {
            await processMonitorCheck(job.data);
        },
        {
            connection: redisConfig,
            concurrency: 10, // Process 10 checks simultaneously
            limiter: {
                max: 100,
                duration: 1000,
            },
        }
    );

    monitorWorker.on('completed', (job) => {
        // Schedule next check
        scheduleNextCheck(job.data);
    });

    monitorWorker.on('failed', (job, err) => {
        console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    // Alert worker
    alertWorker = new Worker(
        QUEUES.ALERTS,
        async (job) => {
            await processAlert(job.data);
        },
        {
            connection: redisConfig,
            concurrency: 5,
        }
    );

    // Load existing monitors into queue
    await loadMonitorsIntoQueue();

    console.log('✅ Workers initialized and running\n');
}

/**
 * Load all active monitors into the queue
 */
async function loadMonitorsIntoQueue() {
    try {
        const monitors = await Monitor.find({ active: true });
        console.log(`📊 Loading ${monitors.length} active monitors into queue...`);

        for (const monitor of monitors) {
            // Stagger initial checks to avoid thundering herd
            const delay = Math.random() * 10000; // Random delay up to 10 seconds
            await addMonitorCheckJob(monitor, delay);
        }
    } catch (error) {
        console.error('Failed to load monitors:', error);
    }
}

/**
 * Schedule the next check for a monitor
 */
async function scheduleNextCheck(monitorData) {
    try {
        const monitor = await Monitor.findById(monitorData.monitorId);
        if (monitor && monitor.active) {
            const delay = monitor.intervalSec * 1000;
            await addMonitorCheckJob(monitor, delay);
        }
    } catch (error) {
        console.error('Failed to schedule next check:', error);
    }
}

/**
 * Process a monitor check
 */
async function processMonitorCheck(data) {
    const { monitorId, teamId } = data;

    try {
        // Perform the check
        const result = await performCheck(data);

        const { success, responseMs, error, statusCode, sslInfo } = result;
        const newStatus = success ? 'up' : 'down';

        // Get current monitor state
        const monitor = await Monitor.findById(monitorId);
        if (!monitor) {
            console.warn(`Monitor ${monitorId} not found`);
            return;
        }

        const previousStatus = monitor.lastStatus;
        const statusChanged = previousStatus !== newStatus && previousStatus !== 'pending';

        // Update consecutive failures
        let consecutiveFailures = monitor.consecutiveFailures || 0;
        if (success) {
            consecutiveFailures = 0;
        } else {
            consecutiveFailures += 1;
        }

        // Update monitor
        const updateData = {
            lastStatus: newStatus,
            lastChecked: new Date(),
            lastResponseMs: responseMs,
            lastError: error,
            consecutiveFailures,
            totalChecks: (monitor.totalChecks || 0) + 1,
        };

        // Update SSL info if available
        if (sslInfo) {
            updateData.sslExpiresAt = sslInfo.expiresAt;
            updateData.sslDaysRemaining = sslInfo.daysRemaining;
            updateData.sslIssuer = sslInfo.issuer;
        }

        await Monitor.findByIdAndUpdate(monitorId, updateData);

        // Save history
        await MonitorHistory.create({
            monitorId,
            success,
            statusCode,
            responseMs,
            error,
            checkedAt: new Date(),
        });

        // Log result
        const emoji = success ? '🟢' : '🔴';
        console.log(
            `${emoji} [${new Date().toLocaleTimeString()}] ${data.url || data.type} - ${newStatus.toUpperCase()} (${responseMs}ms)${error ? ` - ${error}` : ''}`
        );

        // Handle alerts and incidents
        await handleStatusChange({
            monitor,
            previousStatus,
            newStatus,
            statusChanged,
            consecutiveFailures,
            error,
            responseMs,
            teamId,
        });

        // Check SSL expiry alerts
        if (sslInfo && sslInfo.daysRemaining <= 30) {
            await handleSslExpiryAlert(monitor, sslInfo, teamId);
        }

    } catch (err) {
        console.error(`Check failed for ${monitorId}:`, err);
        throw err;
    }
}

/**
 * Handle status changes - create incidents and send alerts
 */
async function handleStatusChange(params) {
    const {
        monitor,
        previousStatus,
        newStatus,
        statusChanged,
        consecutiveFailures,
        error,
        responseMs,
        teamId,
    } = params;

    // Get team for alerts
    const team = await Team.findById(teamId);
    const teamName = team?.name || 'Unknown Team';

    // Monitor went DOWN
    if (newStatus === 'down' && consecutiveFailures === (monitor.alertAfterFailures || 1)) {
        console.log(`🚨 ALERT: ${monitor.name} went DOWN`);

        // Create incident
        const incident = await Incident.create({
            teamId,
            monitorId: monitor._id,
            title: `${monitor.name} is down`,
            description: error || 'Monitor is not responding',
            status: 'investigating',
            severity: 'major',
            type: 'auto',
            timeline: [{
                status: 'investigating',
                message: `Detected: ${error || 'Monitor stopped responding'}`,
            }],
        });

        // Link incident to monitor
        await Monitor.findByIdAndUpdate(monitor._id, {
            currentIncidentId: incident._id,
        });

        // Queue alert
        await addAlertJob({
            type: 'down',
            teamId: teamId.toString(),
            monitorId: monitor._id.toString(),
            monitorName: monitor.name,
            url: monitor.url,
            error,
            teamName,
        });
    }

    // Monitor RECOVERED
    if (statusChanged && newStatus === 'up' && previousStatus === 'down') {
        console.log(`✅ RECOVERY: ${monitor.name} is back UP`);

        // Resolve incident
        if (monitor.currentIncidentId) {
            const incident = await Incident.findById(monitor.currentIncidentId);
            if (incident && incident.status !== 'resolved') {
                incident.status = 'resolved';
                incident.resolvedAt = new Date();
                incident.duration = new Date() - incident.startedAt;
                incident.timeline.push({
                    status: 'resolved',
                    message: `Automatically resolved - Monitor is back online`,
                });
                await incident.save();
            }

            // Clear incident from monitor
            await Monitor.findByIdAndUpdate(monitor._id, {
                currentIncidentId: null,
            });
        }

        // Calculate downtime duration
        const startTime = monitor.currentIncidentId
            ? (await Incident.findById(monitor.currentIncidentId))?.startedAt
            : null;
        const downtimeDuration = startTime ? Date.now() - startTime : null;

        // Queue recovery alert
        await addAlertJob({
            type: 'up',
            teamId: teamId.toString(),
            monitorId: monitor._id.toString(),
            monitorName: monitor.name,
            url: monitor.url,
            responseMs,
            teamName,
            downtimeDuration,
        });
    }
}

/**
 * Handle SSL expiry alerts
 */
async function handleSslExpiryAlert(monitor, sslInfo, teamId) {
    const team = await Team.findById(teamId);
    const teamName = team?.name || 'Unknown Team';

    // Only alert at specific thresholds: 30, 14, 7, 3, 1 days
    const alertDays = [30, 14, 7, 3, 1];
    if (alertDays.includes(sslInfo.daysRemaining)) {
        await addAlertJob({
            type: 'sslExpiry',
            teamId: teamId.toString(),
            monitorId: monitor._id.toString(),
            monitorName: monitor.name,
            url: monitor.url,
            daysRemaining: sslInfo.daysRemaining,
            expiryDate: sslInfo.expiresAt,
            teamName,
        });
    }
}

/**
 * Process an alert job
 */
async function processAlert(data) {
    const alertService = require('../services/alerts');

    try {
        await alertService.sendAlert(data.teamId, data.type, data);
        console.log(`📤 Alert sent: ${data.type} for ${data.monitorName}`);
    } catch (error) {
        console.error('Alert failed:', error);
        throw error; // Let BullMQ retry
    }
}

/**
 * Graceful shutdown
 */
async function shutdownWorkers() {
    console.log('Shutting down workers...');

    if (monitorWorker) {
        await monitorWorker.close();
    }
    if (alertWorker) {
        await alertWorker.close();
    }

    console.log('Workers shut down');
}

/**
 * Add a monitor to the queue
 */
async function addMonitorToQueue(monitor) {
    await addMonitorCheckJob(monitor, 0);
}

/**
 * Remove a monitor from the queue
 */
async function removeMonitorFromQueue(monitorId) {
    const { removeMonitorJobs } = require('../config/queue');
    await removeMonitorJobs(monitorId);
}

module.exports = {
    initializeWorkers,
    shutdownWorkers,
    addMonitorToQueue,
    removeMonitorFromQueue,
};
