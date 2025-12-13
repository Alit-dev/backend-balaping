/**
 * Webhook Alert Service
 * Sends alerts to custom webhook endpoints
 */

/**
 * Send webhook notification
 */
async function sendWebhook(webhookUrl, method, headers, payload) {
    try {
        const response = await fetch(webhookUrl, {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Balaping-Webhook/1.0',
                ...headers,
            },
            body: method === 'GET' ? undefined : JSON.stringify(payload),
        });

        const status = response.status;
        let responseText;
        try {
            responseText = await response.text();
        } catch {
            responseText = '';
        }

        console.log(`🔗 Webhook sent to ${webhookUrl}: ${status}`);

        return {
            success: status >= 200 && status < 300,
            status,
            response: responseText,
        };
    } catch (error) {
        console.error('Webhook send error:', error.message);
        throw error;
    }
}

/**
 * Send monitor DOWN webhook
 */
async function sendMonitorDownWebhook(webhookUrl, method, headers, monitor, error, teamName) {
    const payload = {
        event: 'monitor.down',
        timestamp: new Date().toISOString(),
        monitor: {
            id: monitor._id,
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
        },
        error: error,
        team: teamName,
        status: 'down',
    };

    return sendWebhook(webhookUrl, method, headers, payload);
}

/**
 * Send monitor UP webhook
 */
async function sendMonitorUpWebhook(webhookUrl, method, headers, monitor, responseMs, teamName, downtimeDuration) {
    const payload = {
        event: 'monitor.up',
        timestamp: new Date().toISOString(),
        monitor: {
            id: monitor._id,
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
        },
        responseTime: responseMs,
        downtimeDuration: downtimeDuration,
        team: teamName,
        status: 'up',
    };

    return sendWebhook(webhookUrl, method, headers, payload);
}

/**
 * Send SSL expiry webhook
 */
async function sendSslExpiryWebhook(webhookUrl, method, headers, monitor, daysRemaining, expiryDate) {
    const payload = {
        event: 'ssl.expiring',
        timestamp: new Date().toISOString(),
        monitor: {
            id: monitor._id,
            name: monitor.name,
            url: monitor.url,
        },
        ssl: {
            daysRemaining,
            expiryDate,
        },
    };

    return sendWebhook(webhookUrl, method, headers, payload);
}

/**
 * Send incident webhook
 */
async function sendIncidentWebhook(webhookUrl, method, headers, incident, teamName) {
    const payload = {
        event: `incident.${incident.status}`,
        timestamp: new Date().toISOString(),
        incident: {
            id: incident._id,
            title: incident.title,
            description: incident.description,
            status: incident.status,
            severity: incident.severity,
            startedAt: incident.startedAt,
            resolvedAt: incident.resolvedAt,
        },
        team: teamName,
    };

    return sendWebhook(webhookUrl, method, headers, payload);
}

/**
 * Test webhook connection
 */
async function testWebhook(webhookUrl, method, headers) {
    const payload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        message: 'Balaping webhook test - connection successful!',
    };

    return sendWebhook(webhookUrl, method, headers, payload);
}

module.exports = {
    sendWebhook,
    sendMonitorDownWebhook,
    sendMonitorUpWebhook,
    sendSslExpiryWebhook,
    sendIncidentWebhook,
    testWebhook,
};
