/**
 * Check Dispatcher
 * Routes monitor checks to appropriate checker based on type
 */

const { checkHttp, getSslInfo } = require('./http');
const { checkPing } = require('./ping');
const { checkPort } = require('./port');
const { checkDns } = require('./dns');
const { checkKeyword } = require('./keyword');
const { checkHeartbeat } = require('./heartbeat');
const { checkCronjob } = require('./cronjob');

/**
 * Perform check based on monitor type
 */
async function performCheck(monitor) {
    const type = monitor.type || 'http';

    try {
        switch (type) {
            case 'http':
                return await checkHttp(monitor);

            case 'ping':
                return await checkPing(monitor);

            case 'port':
                return await checkPort(monitor);

            case 'dns':
                return await checkDns(monitor);

            case 'keyword':
                return await checkKeyword(monitor);

            case 'heartbeat':
                return await checkHeartbeat(monitor);

            case 'cronjob':
                return await checkCronjob(monitor);

            default:
                // Fallback to HTTP
                console.warn(`Unknown monitor type: ${type}, falling back to HTTP`);
                return await checkHttp(monitor);
        }
    } catch (error) {
        console.error(`Check failed for monitor ${monitor._id}:`, error);
        return {
            success: false,
            error: error.message || 'Check failed',
            responseMs: 0,
        };
    }
}

/**
 * Get checker function for a type
 */
function getChecker(type) {
    const checkers = {
        http: checkHttp,
        ping: checkPing,
        port: checkPort,
        dns: checkDns,
        keyword: checkKeyword,
        heartbeat: checkHeartbeat,
        cronjob: checkCronjob,
    };

    return checkers[type] || checkHttp;
}

/**
 * Validate monitor configuration for a type
 */
function validateMonitorConfig(monitor) {
    const type = monitor.type || 'http';
    const errors = [];

    switch (type) {
        case 'http':
        case 'keyword':
            if (!monitor.url) errors.push('URL is required');
            if (!monitor.url?.startsWith('http')) errors.push('URL must start with http:// or https://');
            if (type === 'keyword' && !monitor.keyword) errors.push('Keyword is required');
            break;

        case 'ping':
            if (!monitor.url) errors.push('Host/URL is required');
            break;

        case 'port':
            if (!monitor.url) errors.push('Host is required');
            if (!monitor.port) errors.push('Port is required');
            if (monitor.port < 1 || monitor.port > 65535) errors.push('Port must be 1-65535');
            break;

        case 'dns':
            if (!monitor.url) errors.push('Domain is required');
            break;

        case 'heartbeat':
            // No special requirements, token is auto-generated
            break;

        case 'cronjob':
            if (!monitor.cronExpression) errors.push('Cron expression is required');
            break;
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

module.exports = {
    performCheck,
    getChecker,
    validateMonitorConfig,
    // Re-export individual checkers
    checkHttp,
    checkPing,
    checkPort,
    checkDns,
    checkKeyword,
    checkHeartbeat,
    checkCronjob,
    getSslInfo,
};
