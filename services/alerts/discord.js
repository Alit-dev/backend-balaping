/**
 * Discord Alert Service
 * Sends alerts to Discord via Webhooks
 */

/**
 * Send Discord notification
 */
async function sendDiscord(webhookUrl, payload) {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
        }

        return { success: true };
    } catch (error) {
        console.error('Discord send error:', error.message);
        throw error;
    }
}

/**
 * Send monitor DOWN alert
 */
async function sendMonitorDownDiscord(webhookUrl, monitorName, url, error, teamName) {
    const payload = {
        embeds: [
            {
                title: `🔴 Monitor Down: ${monitorName}`,
                url: url,
                color: 15684420, // Red
                description: `Monitor is unreachable.`,
                fields: [
                    { name: 'Error', value: String(error), inline: true },
                    { name: 'Team', value: teamName, inline: true },
                ],
                footer: { text: 'Balaping Alert' },
                timestamp: new Date().toISOString(),
            },
        ],
    };
    return sendDiscord(webhookUrl, payload);
}

/**
 * Send monitor UP alert
 */
async function sendMonitorUpDiscord(webhookUrl, monitorName, url, responseMs, teamName, downtimeDuration) {
    const payload = {
        embeds: [
            {
                title: `✅ Monitor Up: ${monitorName}`,
                url: url,
                color: 2278750, // Green
                description: `Monitor is back online.`,
                fields: [
                    { name: 'Response Time', value: `${responseMs}ms`, inline: true },
                    { name: 'Downtime', value: downtimeDuration || 'N/A', inline: true },
                    { name: 'Team', value: teamName, inline: true },
                ],
                footer: { text: 'Balaping Alert' },
                timestamp: new Date().toISOString(),
            },
        ],
    };
    return sendDiscord(webhookUrl, payload);
}

/**
 * Send SSL expiry alert
 */
async function sendSslExpiryDiscord(webhookUrl, monitorName, url, daysRemaining, expiryDate) {
    const payload = {
        embeds: [
            {
                title: `⚠️ SSL Expiry Warning: ${monitorName}`,
                url: url,
                color: 15383848, // Yellow
                description: `SSL Certificate is expiring soon.`,
                fields: [
                    { name: 'Days Remaining', value: String(daysRemaining), inline: true },
                    { name: 'Expiry Date', value: new Date(expiryDate).toLocaleDateString(), inline: true },
                ],
                footer: { text: 'Balaping Alert' },
                timestamp: new Date().toISOString(),
            },
        ],
    };
    return sendDiscord(webhookUrl, payload);
}

/**
 * Test Discord connection
 */
async function testDiscord(webhookUrl) {
    const payload = {
        content: '✅ Balaping Discord integration is working correctly!',
    };
    return sendDiscord(webhookUrl, payload);
}

module.exports = {
    sendMonitorDownDiscord,
    sendMonitorUpDiscord,
    sendSslExpiryDiscord,
    testDiscord,
};
