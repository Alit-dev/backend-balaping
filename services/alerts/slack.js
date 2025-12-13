/**
 * Slack Alert Service
 * Sends alerts to Slack via Incoming Webhooks
 */

/**
 * Send Slack notification
 */
async function sendSlack(webhookUrl, payload) {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
        }

        return { success: true };
    } catch (error) {
        console.error('Slack send error:', error.message);
        throw error;
    }
}

/**
 * Send monitor DOWN alert
 */
async function sendMonitorDownSlack(webhookUrl, monitorName, url, error, teamName) {
    const payload = {
        attachments: [
            {
                color: '#ef4444', // Red
                title: `🔴 Monitor Down: ${monitorName}`,
                title_link: url,
                text: `Monitor is unreachable.\n*Error:* ${error}\n*Team:* ${teamName}`,
                footer: 'Balaping Alert',
                ts: Math.floor(Date.now() / 1000),
            },
        ],
    };
    return sendSlack(webhookUrl, payload);
}

/**
 * Send monitor UP alert
 */
async function sendMonitorUpSlack(webhookUrl, monitorName, url, responseMs, teamName, downtimeDuration) {
    const payload = {
        attachments: [
            {
                color: '#22c55e', // Green
                title: `✅ Monitor Up: ${monitorName}`,
                title_link: url,
                text: `Monitor is back online.\n*Response Time:* ${responseMs}ms\n*Downtime:* ${downtimeDuration}\n*Team:* ${teamName}`,
                footer: 'Balaping Alert',
                ts: Math.floor(Date.now() / 1000),
            },
        ],
    };
    return sendSlack(webhookUrl, payload);
}

/**
 * Send SSL expiry alert
 */
async function sendSslExpirySlack(webhookUrl, monitorName, url, daysRemaining, expiryDate) {
    const payload = {
        attachments: [
            {
                color: '#eab308', // Yellow
                title: `⚠️ SSL Expiry Warning: ${monitorName}`,
                title_link: url,
                text: `SSL Certificate expires in *${daysRemaining} days* (${new Date(expiryDate).toLocaleDateString()}).`,
                footer: 'Balaping Alert',
                ts: Math.floor(Date.now() / 1000),
            },
        ],
    };
    return sendSlack(webhookUrl, payload);
}

/**
 * Test Slack connection
 */
async function testSlack(webhookUrl) {
    const payload = {
        text: '✅ Balaping Slack integration is working correctly!',
    };
    return sendSlack(webhookUrl, payload);
}

module.exports = {
    sendMonitorDownSlack,
    sendMonitorUpSlack,
    sendSslExpirySlack,
    testSlack,
};
