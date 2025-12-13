/**
 * Telegram Alert Service
 * Uses Telegram Bot API for notifications
 */

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Send message via Telegram Bot
 */
async function sendTelegramMessage(botToken, chatId, message, parseMode = 'HTML') {
    try {
        const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: parseMode,
                disable_web_page_preview: true,
            }),
        });

        const data = await response.json();

        if (!data.ok) {
            console.error('Telegram error:', data);
            throw new Error(data.description || 'Failed to send Telegram message');
        }

        console.log('📱 Telegram message sent:', data.result.message_id);
        return { success: true, messageId: data.result.message_id };
    } catch (error) {
        console.error('Telegram send error:', error.message);
        // In development, log but don't fail
        if (process.env.NODE_ENV === 'development') {
            console.log('📱 [DEV] Would send Telegram to chat:', chatId);
            return { success: true, messageId: 'dev-mode' };
        }
        throw error;
    }
}

/**
 * Send monitor DOWN alert to Telegram
 */
async function sendMonitorDownTelegram(botToken, chatId, monitorName, url, error, teamName) {
    const message = `
🔴 <b>Monitor DOWN</b>

<b>${escapeHtml(monitorName)}</b> is not responding.

📍 <b>URL:</b> ${escapeHtml(url)}
❌ <b>Error:</b> ${escapeHtml(error || 'Connection failed')}
👥 <b>Team:</b> ${escapeHtml(teamName)}
🕐 <b>Time:</b> ${new Date().toLocaleString()}

Check your dashboard for more details.
    `.trim();

    return sendTelegramMessage(botToken, chatId, message);
}

/**
 * Send monitor UP (recovery) alert to Telegram
 */
async function sendMonitorUpTelegram(botToken, chatId, monitorName, url, responseMs, teamName, downtimeDuration) {
    const message = `
🟢 <b>Monitor RECOVERED</b>

<b>${escapeHtml(monitorName)}</b> is back online!

📍 <b>URL:</b> ${escapeHtml(url)}
⚡ <b>Response:</b> ${responseMs}ms
👥 <b>Team:</b> ${escapeHtml(teamName)}
⏱️ <b>Downtime:</b> ${formatDuration(downtimeDuration)}
🕐 <b>Time:</b> ${new Date().toLocaleString()}
    `.trim();

    return sendTelegramMessage(botToken, chatId, message);
}

/**
 * Send SSL expiry warning to Telegram
 */
async function sendSslExpiryTelegram(botToken, chatId, monitorName, url, daysRemaining, expiryDate) {
    const emoji = daysRemaining <= 7 ? '🔴' : daysRemaining <= 14 ? '🟠' : '🟡';

    const message = `
${emoji} <b>SSL Certificate Expiring</b>

<b>${escapeHtml(monitorName)}</b> SSL expires in ${daysRemaining} days.

📍 <b>URL:</b> ${escapeHtml(url)}
📅 <b>Expiry:</b> ${new Date(expiryDate).toLocaleDateString()}

Please renew your SSL certificate soon.
    `.trim();

    return sendTelegramMessage(botToken, chatId, message);
}

/**
 * Send incident notification to Telegram
 */
async function sendIncidentTelegram(botToken, chatId, incident, teamName) {
    const statusEmoji = {
        investigating: '🔍',
        identified: '🎯',
        monitoring: '👀',
        resolved: '✅',
    };

    const severityEmoji = {
        minor: '🟡',
        major: '🟠',
        critical: '🔴',
    };

    const message = `
${statusEmoji[incident.status] || '📢'} <b>Incident Update</b>

${severityEmoji[incident.severity] || ''} <b>${escapeHtml(incident.title)}</b>

<b>Status:</b> ${incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
<b>Severity:</b> ${incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
<b>Team:</b> ${escapeHtml(teamName)}

${incident.description ? `<b>Details:</b>\n${escapeHtml(incident.description)}` : ''}

🕐 ${new Date().toLocaleString()}
    `.trim();

    return sendTelegramMessage(botToken, chatId, message);
}

/**
 * Test Telegram connection
 */
async function testTelegramConnection(botToken, chatId) {
    const message = `
✅ <b>Balaping Connected!</b>

Your Telegram alert channel is now set up.
You'll receive monitor alerts here.

🕐 ${new Date().toLocaleString()}
    `.trim();

    return sendTelegramMessage(botToken, chatId, message);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
    if (!ms) return 'Unknown';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

module.exports = {
    sendTelegramMessage,
    sendMonitorDownTelegram,
    sendMonitorUpTelegram,
    sendSslExpiryTelegram,
    sendIncidentTelegram,
    testTelegramConnection,
};
