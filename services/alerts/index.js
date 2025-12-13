/**
 * Alert Dispatcher
 * Handles sending alerts through all configured channels
 */

const AlertChannel = require('../../models/AlertChannel');
const emailService = require('./email');
const telegramService = require('./telegram');
const slackService = require('./slack');
const discordService = require('./discord');

/**
 * Send alert to all channels configured for a team
 */
async function sendAlert(teamId, alertType, data) {
    try {
        // Get all enabled alert channels for the team
        const channels = await AlertChannel.find({
            teamId,
            enabled: true,
            [`notifyOn.${alertType}`]: true,
        });

        if (channels.length === 0) {
            console.log(`No alert channels configured for ${alertType}`);
            return { sent: 0, failed: 0 };
        }

        const results = await Promise.allSettled(
            channels.map((channel) => sendToChannel(channel, alertType, data))
        );

        const sent = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        console.log(`📤 Alerts sent: ${sent} success, ${failed} failed`);

        return { sent, failed, results };
    } catch (error) {
        console.error('Alert dispatch error:', error);
        throw error;
    }
}

/**
 * Send alert to a specific channel
 */
async function sendToChannel(channel, alertType, data) {
    const { type, config } = channel;

    try {
        let result;

        switch (type) {
            case 'email':
                result = await sendEmailAlert(config, alertType, data);
                break;
            case 'telegram':
                result = await sendTelegramAlert(config, alertType, data);
                break;
            case 'webhook':
                result = await sendWebhookAlert(config, alertType, data);
                break;
            case 'slack':
                result = await sendSlackAlert(config, alertType, data);
                break;
            case 'discord':
                result = await sendDiscordAlert(config, alertType, data);
                break;
            default:
                throw new Error(`Unknown channel type: ${type}`);
        }

        // Update channel stats
        channel.alertsSent += 1;
        channel.lastAlertAt = new Date();
        channel.lastError = null;
        await channel.save();

        return result;
    } catch (error) {
        // Log error to channel
        channel.lastError = error.message;
        await channel.save();
        throw error;
    }
}

/**
 * Send email alert
 */
async function sendEmailAlert(config, alertType, data) {
    const { emails } = config;
    if (!emails || emails.length === 0) {
        throw new Error('No email addresses configured');
    }

    switch (alertType) {
        case 'down':
            return emailService.sendMonitorDownEmail(
                emails,
                data.monitorName,
                data.url,
                data.error,
                data.teamName
            );
        case 'up':
            return emailService.sendMonitorUpEmail(
                emails,
                data.monitorName,
                data.url,
                data.responseMs,
                data.teamName
            );
        case 'sslExpiry':
            return emailService.sendSslExpiryEmail(
                emails,
                data.monitorName,
                data.url,
                data.daysRemaining,
                data.expiryDate,
                data.teamName
            );
        default:
            throw new Error(`Unknown alert type for email: ${alertType}`);
    }
}

/**
 * Send Telegram alert
 */
async function sendTelegramAlert(config, alertType, data) {
    const { telegramBotToken, telegramChatId } = config;
    if (!telegramBotToken || !telegramChatId) {
        throw new Error('Telegram not configured');
    }

    switch (alertType) {
        case 'down':
            return telegramService.sendMonitorDownTelegram(
                telegramBotToken,
                telegramChatId,
                data.monitorName,
                data.url,
                data.error,
                data.teamName
            );
        case 'up':
            return telegramService.sendMonitorUpTelegram(
                telegramBotToken,
                telegramChatId,
                data.monitorName,
                data.url,
                data.responseMs,
                data.teamName,
                data.downtimeDuration
            );
        case 'sslExpiry':
            return telegramService.sendSslExpiryTelegram(
                telegramBotToken,
                telegramChatId,
                data.monitorName,
                data.url,
                data.daysRemaining,
                data.expiryDate
            );
        case 'incident':
            return telegramService.sendIncidentTelegram(
                telegramBotToken,
                telegramChatId,
                data.incident,
                data.teamName
            );
        default:
            throw new Error(`Unknown alert type for Telegram: ${alertType}`);
    }
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(config, alertType, data) {
    const { webhookUrl, webhookMethod, webhookHeaders } = config;
    if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
    }

    const headers = webhookHeaders ? Object.fromEntries(webhookHeaders) : {};

    switch (alertType) {
        case 'down':
            return webhookService.sendMonitorDownWebhook(
                webhookUrl,
                webhookMethod,
                headers,
                data.monitor,
                data.error,
                data.teamName
            );
        case 'up':
            return webhookService.sendMonitorUpWebhook(
                webhookUrl,
                webhookMethod,
                headers,
                data.monitor,
                data.responseMs,
                data.teamName,
                data.downtimeDuration
            );
        case 'sslExpiry':
            return webhookService.sendSslExpiryWebhook(
                webhookUrl,
                webhookMethod,
                headers,
                data.monitor,
                data.daysRemaining,
                data.expiryDate
            );
        case 'incident':
            return webhookService.sendIncidentWebhook(
                webhookUrl,
                webhookMethod,
                headers,
                data.incident,
                data.teamName
            );
        default:
            throw new Error(`Unknown alert type for webhook: ${alertType}`);
    }
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(config, alertType, data) {
    const { webhookUrl } = config;
    if (!webhookUrl) throw new Error('Slack Webhook URL not configured');

    switch (alertType) {
        case 'down':
            return slackService.sendMonitorDownSlack(webhookUrl, data.monitorName, data.url, data.error, data.teamName);
        case 'up':
            return slackService.sendMonitorUpSlack(webhookUrl, data.monitorName, data.url, data.responseMs, data.teamName, data.downtimeDuration);
        case 'sslExpiry':
            return slackService.sendSslExpirySlack(webhookUrl, data.monitorName, data.url, data.daysRemaining, data.expiryDate);
        default:
            // For now, just log or ignore unknown types for Slack
            console.warn(`Unknown alert type for Slack: ${alertType}`);
            return;
    }
}

/**
 * Send Discord alert
 */
async function sendDiscordAlert(config, alertType, data) {
    const { webhookUrl } = config;
    if (!webhookUrl) throw new Error('Discord Webhook URL not configured');

    switch (alertType) {
        case 'down':
            return discordService.sendMonitorDownDiscord(webhookUrl, data.monitorName, data.url, data.error, data.teamName);
        case 'up':
            return discordService.sendMonitorUpDiscord(webhookUrl, data.monitorName, data.url, data.responseMs, data.teamName, data.downtimeDuration);
        case 'sslExpiry':
            return discordService.sendSslExpiryDiscord(webhookUrl, data.monitorName, data.url, data.daysRemaining, data.expiryDate);
        default:
            console.warn(`Unknown alert type for Discord: ${alertType}`);
            return;
    }
}

/**
 * Test an alert channel
 */
async function testChannel(channel) {
    const { type, config } = channel;

    switch (type) {
        case 'email':
            return emailService.sendEmail({
                to: config.emails,
                subject: '✅ Balaping Alert Test',
                html: '<h2>Test Successful!</h2><p>Your email alert channel is working correctly.</p>',
                text: 'Your email alert channel is working correctly.',
            });
        case 'telegram':
            return telegramService.testTelegramConnection(
                config.telegramBotToken,
                config.telegramChatId
            );
        case 'webhook':
            return webhookService.testWebhook(
                config.webhookUrl,
                config.webhookMethod,
                config.webhookHeaders ? Object.fromEntries(config.webhookHeaders) : {}
            );
        case 'slack':
            return slackService.testSlack(config.webhookUrl);
        case 'discord':
            return discordService.testDiscord(config.webhookUrl);
        default:
            throw new Error(`Unknown channel type: ${type}`);
    }
}

module.exports = {
    sendAlert,
    sendToChannel,
    testChannel,
};
