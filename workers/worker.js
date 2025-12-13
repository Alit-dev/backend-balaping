/**
 * Worker Engine - Performs HTTP checks on monitors
 * Uses setInterval - No Redis required!
 */

const axios = require('axios');
const Monitor = require('../models/Monitor');
const MonitorHistory = require('../models/MonitorHistory');
const Team = require('../models/Team');
const User = require('../models/User');
const Incident = require('../models/Incident');
const workerCache = require('./workerCache');
const alertService = require('../services/alerts');
const socketService = require('../services/socketService');

// Check interval in milliseconds (how often to tick)
const TICK_INTERVAL_MS = 1000; // Check every 1 second

/**
 * Initialize worker - Load all active monitors
 */
async function initializeWorker() {
    try {
        const monitors = await Monitor.find({ active: true });

        console.log(`\n🚀 Initializing worker with ${monitors.length} active monitors...\n`);

        for (const monitor of monitors) {
            workerCache.addMonitor(monitor);
        }

        // Start the main loop
        startWorkerLoop();

        console.log('✅ Worker initialized and running\n');
    } catch (error) {
        console.error('❌ Failed to initialize worker:', error);
    }
}

/**
 * Start the main worker loop
 */
function startWorkerLoop() {
    setInterval(async () => {
        try {
            await runChecks();
        } catch (error) {
            console.error('Worker loop error:', error);
        }
    }, TICK_INTERVAL_MS);
}

/**
 * Run checks for monitors that are due
 */
async function runChecks() {
    const monitorsToRun = workerCache.getMonitorsToRun();

    // Run checks in parallel (but limit concurrency)
    const CONCURRENCY_LIMIT = 10;

    for (let i = 0; i < monitorsToRun.length; i += CONCURRENCY_LIMIT) {
        const batch = monitorsToRun.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(checkMonitor));
    }
}

/**
 * Perform HTTP check for a single monitor
 */
async function checkMonitor(monitorData) {
    const startTime = Date.now();
    let success = false;
    let statusCode = null;
    let responseMs = 0;
    let error = null;

    try {
        const response = await axios({
            method: monitorData.method,
            url: monitorData.url,
            timeout: monitorData.timeout,
            headers: monitorData.headers || {},
            data: monitorData.method === 'POST' ? monitorData.body : undefined,
            validateStatus: () => true, // Don't throw on any status code
        });

        responseMs = Date.now() - startTime;
        statusCode = response.status;
        success = statusCode === monitorData.expectedCode;

        if (!success) {
            error = `Expected ${monitorData.expectedCode}, got ${statusCode}`;
        }
    } catch (err) {
        responseMs = Date.now() - startTime;
        error = err.code || err.message || 'Connection failed';
        success = false;
    }

    // Calculate next run time
    const nextRunAt = Date.now() + monitorData.intervalSec * 1000;

    // Update cache and check for status change
    const result = workerCache.updateAfterCheck(
        monitorData.monitorId,
        success,
        responseMs,
        nextRunAt
    );

    // Save to database
    try {
        // Update monitor document
        await Monitor.findByIdAndUpdate(monitorData.monitorId, {
            lastStatus: success ? 'up' : 'down',
            lastChecked: new Date(),
            lastResponseMs: responseMs,
            lastError: error,
            consecutiveFailures: result ? result.consecutiveFailures : 0,
        });

        // Save history
        await MonitorHistory.create({
            monitorId: monitorData.monitorId,
            success,
            statusCode,
            responseMs,
            error,
            checkedAt: new Date(),
        });

        // Log check result
        const statusEmoji = success ? '🟢' : '🔴';
        console.log(
            `${statusEmoji} [${new Date().toLocaleTimeString()}] ${monitorData.url} - ${success ? 'UP' : 'DOWN'} (${responseMs}ms)${error ? ` - ${error}` : ''}`
        );

        // Emit check event
        socketService.emitToTeam(monitorData.teamId, 'monitor_check', {
            monitorId: monitorData.monitorId,
            success,
            responseMs,
            checkedAt: new Date(),
            error,
        });

        // Handle alerts and incidents
        await handleStatusChange({
            monitor: await Monitor.findById(monitorData.monitorId), // Re-fetch to get latest state
            previousStatus: result.previousStatus,
            newStatus: result.newStatus,
            statusChanged: result.statusChanged,
            consecutiveFailures: result.consecutiveFailures,
            error,
            responseMs,
            teamId: monitorData.teamId,
        });
    } catch (dbError) {
        console.error('Database error:', dbError.message);
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
    // Trigger if:
    // 1. Just reached the failure threshold
    // 2. OR is already down (past threshold) but has no active incident (e.g. missed due to restart/bug)
    const isThresholdReached = consecutiveFailures === (monitor.alertAfterFailures || 1);
    const isAlreadyDownMissingIncident = newStatus === 'down' &&
        consecutiveFailures > (monitor.alertAfterFailures || 1) &&
        !monitor.currentIncidentId;

    if ((newStatus === 'down' && isThresholdReached) || isAlreadyDownMissingIncident) {
        console.log(`🚨 ALERT: ${monitor.name} is DOWN (Incident created)`);

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

        // Send alert
        await alertService.sendAlert(teamId, 'down', {
            monitorName: monitor.name,
            url: monitor.url,
            error,
            teamName,
        });

        // Emit status change event
        socketService.emitToTeam(teamId, 'monitor_status_changed', {
            monitorId: monitor._id,
            status: 'down',
            incidentId: incident._id,
        });
    }

    // Monitor RECOVERED
    if (statusChanged && newStatus === 'up' && previousStatus === 'down') {
        console.log(`✅ RECOVERY: ${monitor.name} is back UP`);

        // Resolve incident
        let downtimeDuration = null;
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
                downtimeDuration = incident.duration;
            }

            // Clear incident from monitor
            await Monitor.findByIdAndUpdate(monitor._id, {
                currentIncidentId: null,
            });
        }

        // Send recovery alert
        await alertService.sendAlert(teamId, 'up', {
            monitorName: monitor.name,
            url: monitor.url,
            responseMs,
            teamName,
            downtimeDuration,
        });

        // Emit status change event
        socketService.emitToTeam(teamId, 'monitor_status_changed', {
            monitorId: monitor._id,
            status: 'up',
        });
    }
}

/**
 * Get worker stats
 */
function getWorkerStats() {
    return workerCache.getStats();
}

module.exports = {
    initializeWorker,
    getWorkerStats,
};
