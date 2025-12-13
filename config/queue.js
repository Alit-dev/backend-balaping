/**
 * BullMQ Queue Configuration
 * Handles job scheduling and processing for monitor checks
 */

const { Queue, Worker, QueueScheduler } = require('bullmq');
const { redisConfig } = require('./redis');

// Queue names
const QUEUES = {
    MONITOR_CHECKS: 'monitor-checks',
    ALERTS: 'alerts',
    INCIDENTS: 'incidents',
    SSL_CHECKS: 'ssl-checks',
};

// Create queues
const monitorQueue = new Queue(QUEUES.MONITOR_CHECKS, {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

const alertQueue = new Queue(QUEUES.ALERTS, {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

const incidentQueue = new Queue(QUEUES.INCIDENTS, {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

const sslQueue = new Queue(QUEUES.SSL_CHECKS, {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 100,
    },
});

/**
 * Add monitor check job
 */
async function addMonitorCheckJob(monitor, delay = 0) {
    const jobId = `check-${monitor._id}`;

    await monitorQueue.add(
        'check',
        {
            monitorId: monitor._id.toString(),
            teamId: monitor.teamId.toString(),
            type: monitor.type,
            url: monitor.url,
            method: monitor.method,
            timeout: monitor.timeout,
            headers: monitor.headers,
            body: monitor.body,
            expectedCode: monitor.expectedCode,
            port: monitor.port,
            portProtocol: monitor.portProtocol,
            dnsRecordType: monitor.dnsRecordType,
            dnsExpectedValue: monitor.dnsExpectedValue,
            keyword: monitor.keyword,
            keywordType: monitor.keywordType,
            sslCheck: monitor.sslCheck,
            intervalSec: monitor.intervalSec,
            alertAfterFailures: monitor.alertAfterFailures,
        },
        {
            jobId,
            delay,
            priority: getPriority(monitor.intervalSec),
        }
    );
}

/**
 * Add alert job
 */
async function addAlertJob(alertData) {
    await alertQueue.add('send', alertData, {
        priority: alertData.type === 'down' ? 1 : 2,
    });
}

/**
 * Add incident job
 */
async function addIncidentJob(incidentData) {
    await incidentQueue.add('process', incidentData);
}

/**
 * Schedule SSL check
 */
async function addSslCheckJob(monitor) {
    await sslQueue.add('check', {
        monitorId: monitor._id.toString(),
        url: monitor.url,
    });
}

/**
 * Remove all jobs for a monitor
 */
async function removeMonitorJobs(monitorId) {
    const jobId = `check-${monitorId}`;
    const job = await monitorQueue.getJob(jobId);
    if (job) {
        await job.remove();
    }
}

/**
 * Get priority based on interval (lower interval = higher priority)
 */
function getPriority(intervalSec) {
    if (intervalSec <= 30) return 1;
    if (intervalSec <= 60) return 2;
    if (intervalSec <= 300) return 3;
    return 4;
}

/**
 * Get queue stats
 */
async function getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
        monitorQueue.getWaitingCount(),
        monitorQueue.getActiveCount(),
        monitorQueue.getCompletedCount(),
        monitorQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
}

/**
 * Close all queues
 */
async function closeQueues() {
    await Promise.all([
        monitorQueue.close(),
        alertQueue.close(),
        incidentQueue.close(),
        sslQueue.close(),
    ]);
}

module.exports = {
    QUEUES,
    monitorQueue,
    alertQueue,
    incidentQueue,
    sslQueue,
    addMonitorCheckJob,
    addAlertJob,
    addIncidentJob,
    addSslCheckJob,
    removeMonitorJobs,
    getQueueStats,
    closeQueues,
};
