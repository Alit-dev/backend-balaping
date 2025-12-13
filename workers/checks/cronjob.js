/**
 * Cronjob Monitor
 * Monitors scheduled tasks for expected execution
 */

const Monitor = require('../../models/Monitor');

/**
 * Parse a simple cron expression and get next expected run
 * Supports: minute hour day month weekday
 * Simple implementation - for production, use node-cron or similar
 */
function getNextCronRun(cronExpression) {
    // For simplicity, we'll parse common patterns
    // Full cron parsing would require a library like 'cron-parser'
    const parts = cronExpression.trim().split(/\s+/);

    if (parts.length !== 5) {
        return null;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Very basic implementation - handles simple cases
    // For production, use 'cron-parser' package

    // Set minutes
    if (minute !== '*') {
        next.setMinutes(parseInt(minute, 10));
        if (next <= now) {
            next.setHours(next.getHours() + 1);
        }
    }

    // Set hours
    if (hour !== '*') {
        next.setHours(parseInt(hour, 10));
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
    }

    next.setSeconds(0);
    next.setMilliseconds(0);

    return next;
}

/**
 * Check cronjob status
 */
async function checkCronjob(monitor) {
    const now = new Date();
    const lastCronRun = monitor.lastCronRun;
    const gracePeriod = monitor.cronGracePeriod || 60; // seconds
    const cronExpression = monitor.cronExpression;

    let success = false;
    let error = null;

    if (!cronExpression) {
        error = 'No cron expression specified';
        return { success: false, error, responseMs: 0 };
    }

    if (!lastCronRun) {
        // Never received a cron ping - might be first run
        // Check if we're past the expected run time
        const expectedRun = getNextCronRun(cronExpression);
        if (expectedRun && now > new Date(expectedRun.getTime() + gracePeriod * 1000)) {
            error = 'Cron job never reported';
            success = false;
        } else {
            // Still waiting for first run
            success = true;
        }
    } else {
        // Calculate if the last run is within expected time frame
        // This is a simplified version - production should use proper cron parsing
        const expectedRun = monitor.expectedCronRun || getNextCronRun(cronExpression);

        if (expectedRun) {
            const expectedTime = new Date(expectedRun);
            const graceEndTime = new Date(expectedTime.getTime() + gracePeriod * 1000);

            if (now > graceEndTime && lastCronRun < expectedTime) {
                error = `Cron job missed at ${expectedTime.toISOString()}`;
                success = false;
            } else {
                success = true;
            }
        } else {
            success = true;
        }
    }

    return {
        success,
        error,
        responseMs: 0,
        lastCronRun,
    };
}

/**
 * Record cron job execution
 * Called when a cron job pings the endpoint
 */
async function recordCronRun(token, status = 'success', duration = null) {
    const monitor = await Monitor.findOne({
        heartbeatToken: token, // Reuse heartbeat token for cronjob
        type: 'cronjob',
        active: true,
    });

    if (!monitor) {
        return { success: false, error: 'Invalid cronjob token' };
    }

    const now = new Date();

    monitor.lastCronRun = now;
    monitor.lastChecked = now;

    if (status === 'success') {
        monitor.lastStatus = 'up';
        monitor.consecutiveFailures = 0;
        monitor.lastError = null;
        monitor.lastResponseMs = duration || 0;
    } else {
        monitor.lastStatus = 'down';
        monitor.consecutiveFailures += 1;
        monitor.lastError = status;
    }

    // Calculate next expected run
    if (monitor.cronExpression) {
        monitor.expectedCronRun = getNextCronRun(monitor.cronExpression);
    }

    await monitor.save();

    return {
        success: true,
        monitorId: monitor._id,
        monitorName: monitor.name,
        nextExpectedRun: monitor.expectedCronRun,
    };
}

module.exports = { checkCronjob, recordCronRun, getNextCronRun };
