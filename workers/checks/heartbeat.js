/**
 * Heartbeat Monitor
 * Passive monitor that expects periodic heartbeat pings
 */

const Monitor = require('../../models/Monitor');

/**
 * Check heartbeat status
 * This is checked by the worker, not by making an outbound request
 */
async function checkHeartbeat(monitor) {
    const now = new Date();
    const lastHeartbeat = monitor.lastHeartbeat;
    const expectedInterval = monitor.heartbeatInterval || 300; // seconds
    const gracePeriod = 30; // 30 seconds grace period

    let success = false;
    let error = null;

    if (!lastHeartbeat) {
        // Never received a heartbeat
        error = 'No heartbeat received yet';
        success = false;
    } else {
        const secondsSinceLastHeartbeat = (now - lastHeartbeat) / 1000;
        const maxAllowedInterval = expectedInterval + gracePeriod;

        if (secondsSinceLastHeartbeat <= maxAllowedInterval) {
            success = true;
        } else {
            const missedBy = Math.round(secondsSinceLastHeartbeat - expectedInterval);
            error = `Heartbeat missed by ${missedBy} seconds`;
            success = false;
        }
    }

    return {
        success,
        error,
        responseMs: 0, // No actual request made
        lastHeartbeat,
    };
}

/**
 * Record a heartbeat
 * Called when the heartbeat endpoint is hit
 */
async function recordHeartbeat(token) {
    const monitor = await Monitor.findOne({
        heartbeatToken: token,
        type: 'heartbeat',
        active: true,
    });

    if (!monitor) {
        return { success: false, error: 'Invalid heartbeat token' };
    }

    monitor.lastHeartbeat = new Date();
    monitor.lastStatus = 'up';
    monitor.lastChecked = new Date();
    monitor.consecutiveFailures = 0;
    monitor.lastError = null;
    await monitor.save();

    return {
        success: true,
        monitorId: monitor._id,
        monitorName: monitor.name,
    };
}

module.exports = { checkHeartbeat, recordHeartbeat };
