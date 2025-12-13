/**
 * Email Service
 * Uses Nodemailer for SMTP emails (Gmail, etc.)
 */

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Balaping <alerts@balaping.com>';

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

/**
 * Send email via Nodemailer
 */
async function sendEmail({ to, subject, html, text }) {
    try {
        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
            console.warn('⚠️ SMTP not configured. Email would have been sent to:', to);
            return { success: false, error: 'SMTP not configured' };
        }

        const info = await transporter.sendMail({
            from: FROM_EMAIL,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
            text,
        });

        console.log('📧 Email sent:', info.messageId);
        return { success: true, id: info.messageId };
    } catch (error) {
        console.error('Email send error:', error.message);
        // In development, log but don't fail hard
        if (process.env.NODE_ENV === 'development') {
            console.log('📧 [DEV] Failed to send email to:', to, 'Error:', error.message);
        }
        throw error;
    }
}

/**
 * Send verification email
 */
async function sendVerificationEmail(email, name, token) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4F6DF5; margin-bottom: 30px; }
        .button { display: inline-block; background: #4F6DF5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Balaping</div>
        <h2>Verify your email</h2>
        <p>Hi ${name},</p>
        <p>Thanks for signing up! Please verify your email address to get started.</p>
        <p style="margin: 30px 0;">
            <a href="${verifyUrl}" class="button">Verify Email</a>
        </p>
        <p>Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
        <div class="footer">
            <p>Balaping - Uptime Monitoring Made Simple</p>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: email,
        subject: 'Verify your Balaping account',
        html,
        text: `Hi ${name}, verify your email: ${verifyUrl}`,
    });
}

/**
 * Send password reset email
 */
async function sendResetPasswordEmail(email, name, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4F6DF5; margin-bottom: 30px; }
        .button { display: inline-block; background: #4F6DF5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Balaping</div>
        <h2>Reset your password</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <p style="margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
        </p>
        <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        <div class="footer">
            <p>Balaping - Uptime Monitoring Made Simple</p>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: email,
        subject: 'Reset your Balaping password',
        html,
        text: `Hi ${name}, reset your password: ${resetUrl}`,
    });
}

/**
 * Send monitor DOWN alert
 */
async function sendMonitorDownEmail(emails, monitorName, url, error, teamName) {
    const dashboardUrl = `${process.env.FRONTEND_URL}/monitors`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4F6DF5; margin-bottom: 30px; }
        .alert-box { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .alert-title { color: #DC2626; font-weight: bold; font-size: 18px; margin-bottom: 10px; }
        .button { display: inline-block; background: #4F6DF5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        .meta { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Balaping</div>
        <div class="alert-box">
            <div class="alert-title">🔴 Monitor DOWN</div>
            <p><strong>${monitorName}</strong> is not responding.</p>
        </div>
        <table style="width: 100%; margin: 20px 0;">
            <tr><td class="meta">URL:</td><td>${url}</td></tr>
            <tr><td class="meta">Error:</td><td>${error || 'Connection failed'}</td></tr>
            <tr><td class="meta">Team:</td><td>${teamName}</td></tr>
            <tr><td class="meta">Time:</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <p style="margin: 30px 0;">
            <a href="${dashboardUrl}" class="button">View Dashboard</a>
        </p>
        <div class="footer">
            <p>Balaping - Uptime Monitoring Made Simple</p>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: emails,
        subject: `🔴 DOWN: ${monitorName}`,
        html,
        text: `Monitor DOWN: ${monitorName} (${url}) - ${error}`,
    });
}

/**
 * Send monitor UP (recovery) alert
 */
async function sendMonitorUpEmail(emails, monitorName, url, responseMs, teamName) {
    const dashboardUrl = `${process.env.FRONTEND_URL}/monitors`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4F6DF5; margin-bottom: 30px; }
        .alert-box { background: #D1FAE5; border-left: 4px solid #22C55E; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .alert-title { color: #16A34A; font-weight: bold; font-size: 18px; margin-bottom: 10px; }
        .button { display: inline-block; background: #4F6DF5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        .meta { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Balaping</div>
        <div class="alert-box">
            <div class="alert-title">🟢 Monitor RECOVERED</div>
            <p><strong>${monitorName}</strong> is back online!</p>
        </div>
        <table style="width: 100%; margin: 20px 0;">
            <tr><td class="meta">URL:</td><td>${url}</td></tr>
            <tr><td class="meta">Response Time:</td><td>${responseMs}ms</td></tr>
            <tr><td class="meta">Team:</td><td>${teamName}</td></tr>
            <tr><td class="meta">Time:</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <p style="margin: 30px 0;">
            <a href="${dashboardUrl}" class="button">View Dashboard</a>
        </p>
        <div class="footer">
            <p>Balaping - Uptime Monitoring Made Simple</p>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: emails,
        subject: `🟢 RECOVERED: ${monitorName}`,
        html,
        text: `Monitor RECOVERED: ${monitorName} (${url}) - Response: ${responseMs}ms`,
    });
}

/**
 * Send SSL expiry warning
 */
async function sendSslExpiryEmail(emails, monitorName, url, daysRemaining, expiryDate, teamName) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4F6DF5; margin-bottom: 30px; }
        .alert-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .alert-title { color: #D97706; font-weight: bold; font-size: 18px; margin-bottom: 10px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Balaping</div>
        <div class="alert-box">
            <div class="alert-title">⚠️ SSL Certificate Expiring Soon</div>
            <p><strong>${monitorName}</strong> SSL certificate expires in ${daysRemaining} days.</p>
        </div>
        <p>URL: ${url}</p>
        <p>Expiry Date: ${new Date(expiryDate).toLocaleDateString()}</p>
        <p>Team: ${teamName}</p>
        <div class="footer">
            <p>Balaping - Uptime Monitoring Made Simple</p>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: emails,
        subject: `⚠️ SSL Expiring: ${monitorName} (${daysRemaining} days)`,
        html,
        text: `SSL Certificate for ${monitorName} (${url}) expires in ${daysRemaining} days`,
    });
}

/**
 * Send team invitation email
 */
async function sendTeamInviteEmail(email, inviterName, teamName, role, inviteUrl) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4F6DF5; margin-bottom: 30px; }
        .button { display: inline-block; background: #4F6DF5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡ Balaping</div>
        <h2>You've been invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> as a ${role}.</p>
        <p style="margin: 30px 0;">
            <a href="${inviteUrl}" class="button">Accept Invitation</a>
        </p>
        <p>This invitation expires in 7 days.</p>
        <div class="footer">
            <p>Balaping - Uptime Monitoring Made Simple</p>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: email,
        subject: `Join ${teamName} on Balaping`,
        html,
        text: `${inviterName} invited you to join ${teamName}. Accept: ${inviteUrl}`,
    });
}

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendResetPasswordEmail,
    sendMonitorDownEmail,
    sendMonitorUpEmail,
    sendSslExpiryEmail,
    sendTeamInviteEmail,
};
