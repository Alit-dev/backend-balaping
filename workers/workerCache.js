/**
 * Worker Cache - In-memory cache for monitor scheduling
 * Uses JavaScript Map() - No Redis required!
 */

class WorkerCache {
    constructor() {
        // Map: monitorId -> { nextRunAt, lastStatus, lastResponseMs, consecutiveFailures, active }
        this.cache = new Map();
    }

    /**
     * Add a monitor to the cache
     */
    addMonitor(monitor) {
        if (!monitor.active) return;

        this.cache.set(monitor._id.toString(), {
            monitorId: monitor._id.toString(),
            teamId: monitor.teamId.toString(),
            url: monitor.url,
            method: monitor.method,
            intervalSec: monitor.intervalSec,
            expectedCode: monitor.expectedCode,
            timeout: monitor.timeout,
            headers: monitor.headers,
            body: monitor.body,
            alertAfterFailures: monitor.alertAfterFailures,
            nextRunAt: Date.now(), // Run immediately
            lastStatus: monitor.lastStatus || 'pending',
            lastResponseMs: monitor.lastResponseMs || 0,
            consecutiveFailures: monitor.consecutiveFailures || 0,
            active: true,
        });

        console.log(`📡 Added monitor: ${monitor.name} (${monitor.url})`);
    }

    /**
     * Update a monitor in the cache
     */
    updateMonitor(monitor) {
        const existing = this.cache.get(monitor._id.toString());

        if (!monitor.active) {
            this.removeMonitor(monitor._id.toString());
            return;
        }

        this.cache.set(monitor._id.toString(), {
            monitorId: monitor._id.toString(),
            teamId: monitor.teamId.toString(),
            url: monitor.url,
            method: monitor.method,
            intervalSec: monitor.intervalSec,
            expectedCode: monitor.expectedCode,
            timeout: monitor.timeout,
            headers: monitor.headers,
            body: monitor.body,
            alertAfterFailures: monitor.alertAfterFailures,
            nextRunAt: existing ? existing.nextRunAt : Date.now(),
            lastStatus: existing ? existing.lastStatus : 'pending',
            lastResponseMs: existing ? existing.lastResponseMs : 0,
            consecutiveFailures: existing ? existing.consecutiveFailures : 0,
            active: true,
        });

        console.log(`🔄 Updated monitor: ${monitor._id}`);
    }

    /**
     * Remove a monitor from the cache
     */
    removeMonitor(monitorId) {
        this.cache.delete(monitorId);
        console.log(`🗑️ Removed monitor: ${monitorId}`);
    }

    /**
     * Pause a monitor
     */
    pauseMonitor(monitorId) {
        const monitor = this.cache.get(monitorId);
        if (monitor) {
            monitor.active = false;
            console.log(`⏸️ Paused monitor: ${monitorId}`);
        }
    }

    /**
     * Resume a monitor
     */
    resumeMonitor(monitor) {
        this.cache.set(monitor._id.toString(), {
            monitorId: monitor._id.toString(),
            teamId: monitor.teamId.toString(),
            url: monitor.url,
            method: monitor.method,
            intervalSec: monitor.intervalSec,
            expectedCode: monitor.expectedCode,
            timeout: monitor.timeout,
            headers: monitor.headers,
            body: monitor.body,
            alertAfterFailures: monitor.alertAfterFailures,
            nextRunAt: Date.now(),
            lastStatus: 'pending',
            lastResponseMs: 0,
            consecutiveFailures: 0,
            active: true,
        });

        console.log(`▶️ Resumed monitor: ${monitor._id}`);
    }

    /**
     * Get monitors that need to run now
     */
    getMonitorsToRun() {
        const now = Date.now();
        const toRun = [];

        for (const [id, data] of this.cache) {
            if (data.active && data.nextRunAt <= now) {
                toRun.push(data);
            }
        }

        return toRun;
    }

    /**
     * Update monitor after check
     */
    updateAfterCheck(monitorId, success, responseMs, nextRunAt) {
        const monitor = this.cache.get(monitorId);
        if (monitor) {
            const previousStatus = monitor.lastStatus;
            monitor.lastStatus = success ? 'up' : 'down';
            monitor.lastResponseMs = responseMs;
            monitor.nextRunAt = nextRunAt;
            monitor.consecutiveFailures = success ? 0 : monitor.consecutiveFailures + 1;

            return {
                statusChanged: previousStatus !== monitor.lastStatus,
                previousStatus,
                newStatus: monitor.lastStatus,
                consecutiveFailures: monitor.consecutiveFailures,
                alertAfterFailures: monitor.alertAfterFailures,
            };
        }
        return null;
    }

    /**
     * Get cache stats
     */
    getStats() {
        let active = 0;
        let up = 0;
        let down = 0;

        for (const [id, data] of this.cache) {
            if (data.active) {
                active++;
                if (data.lastStatus === 'up') up++;
                if (data.lastStatus === 'down') down++;
            }
        }

        return { total: this.cache.size, active, up, down };
    }

    /**
     * Get all monitors
     */
    getAll() {
        return Array.from(this.cache.values());
    }
}

module.exports = new WorkerCache();
