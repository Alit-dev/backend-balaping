const transporter = require('../config/mailer');

// Email templates
const templates = {
  verification: (name, link) => ({
    subject: 'Verify your Balaping account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F8F8F8; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 700; color: #4F6DF5; margin-bottom: 24px; }
          h1 { color: #1a1a1a; font-size: 20px; margin: 0 0 16px; }
          p { color: #666; line-height: 1.6; margin: 0 0 24px; }
          .button { display: inline-block; background: #4F6DF5; color: #FFFFFF !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; }
          .button:hover { background: #3D5BD9; }
          .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #EAEAEA; color: #999; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ Balaping</div>
          <h1>Verify your email</h1>
          <p>Hi ${name},</p>
          <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
          <a href="${link}" class="button">Verify Email</a>
          <p style="margin-top: 24px; font-size: 13px; color: #999;">This link expires in 24 hours.</p>
          <div class="footer">
            If you didn't create an account, you can safely ignore this email.
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  resetPassword: (name, link) => ({
    subject: 'Reset your Balaping password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F8F8F8; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 700; color: #4F6DF5; margin-bottom: 24px; }
          h1 { color: #1a1a1a; font-size: 20px; margin: 0 0 16px; }
          p { color: #666; line-height: 1.6; margin: 0 0 24px; }
          .button { display: inline-block; background: #4F6DF5; color: #FFFFFF !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; }
          .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #EAEAEA; color: #999; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ Balaping</div>
          <h1>Reset your password</h1>
          <p>Hi ${name},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <a href="${link}" class="button">Reset Password</a>
          <p style="margin-top: 24px; font-size: 13px; color: #999;">This link expires in 1 hour.</p>
          <div class="footer">
            If you didn't request this, you can safely ignore this email.
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  teamInvite: (teamName, inviterName, link) => ({
    subject: `You've been invited to join ${teamName} on Balaping`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F8F8F8; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 700; color: #4F6DF5; margin-bottom: 24px; }
          h1 { color: #1a1a1a; font-size: 20px; margin: 0 0 16px; }
          p { color: #666; line-height: 1.6; margin: 0 0 24px; }
          .button { display: inline-block; background: #4F6DF5; color: #FFFFFF !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; }
          .team-name { background: #F8F8F8; padding: 16px; border-radius: 12px; font-weight: 600; color: #1a1a1a; margin: 16px 0; }
          .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #EAEAEA; color: #999; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ Balaping</div>
          <h1>You're invited!</h1>
          <p>${inviterName} has invited you to join their team on Balaping:</p>
          <div class="team-name">${teamName}</div>
          <p>Click the button below to accept the invitation:</p>
          <a href="${link}" class="button">Accept Invitation</a>
          <p style="margin-top: 24px; font-size: 13px; color: #999;">This invitation expires in 7 days.</p>
          <div class="footer">
            Balaping is a lightweight uptime monitoring platform.
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  monitorDown: (monitorName, url, error, teamName) => ({
    subject: `🔴 DOWN: ${monitorName} is not responding`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F8F8F8; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 700; color: #4F6DF5; margin-bottom: 24px; }
          .status { display: inline-block; background: #FEE2E2; color: #EF4444; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-bottom: 16px; }
          h1 { color: #1a1a1a; font-size: 20px; margin: 0 0 16px; }
          p { color: #666; line-height: 1.6; margin: 0 0 16px; }
          .details { background: #F8F8F8; padding: 16px; border-radius: 12px; margin: 16px 0; }
          .details p { margin: 8px 0; font-size: 14px; }
          .label { color: #999; }
          .value { color: #1a1a1a; font-weight: 500; }
          .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #EAEAEA; color: #999; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ Balaping</div>
          <span class="status">🔴 DOWN</span>
          <h1>${monitorName} is down</h1>
          <div class="details">
            <p><span class="label">URL:</span> <span class="value">${url}</span></p>
            <p><span class="label">Error:</span> <span class="value">${error || 'Connection failed'}</span></p>
            <p><span class="label">Team:</span> <span class="value">${teamName}</span></p>
            <p><span class="label">Time:</span> <span class="value">${new Date().toISOString()}</span></p>
          </div>
          <div class="footer">
            You're receiving this because you're a member of ${teamName}.
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  monitorUp: (monitorName, url, responseMs, teamName) => ({
    subject: `🟢 UP: ${monitorName} is back online`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F8F8F8; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 700; color: #4F6DF5; margin-bottom: 24px; }
          .status { display: inline-block; background: #DCFCE7; color: #22C55E; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-bottom: 16px; }
          h1 { color: #1a1a1a; font-size: 20px; margin: 0 0 16px; }
          p { color: #666; line-height: 1.6; margin: 0 0 16px; }
          .details { background: #F8F8F8; padding: 16px; border-radius: 12px; margin: 16px 0; }
          .details p { margin: 8px 0; font-size: 14px; }
          .label { color: #999; }
          .value { color: #1a1a1a; font-weight: 500; }
          .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #EAEAEA; color: #999; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ Balaping</div>
          <span class="status">🟢 UP</span>
          <h1>${monitorName} is back online</h1>
          <div class="details">
            <p><span class="label">URL:</span> <span class="value">${url}</span></p>
            <p><span class="label">Response time:</span> <span class="value">${responseMs}ms</span></p>
            <p><span class="label">Team:</span> <span class="value">${teamName}</span></p>
            <p><span class="label">Time:</span> <span class="value">${new Date().toISOString()}</span></p>
          </div>
          <div class="footer">
            You're receiving this because you're a member of ${teamName}.
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send email helper
const sendEmail = async (to, template) => {
  try {
    await transporter.sendMail({
      from: `"Balaping" <${process.env.FROM_EMAIL}>`,
      to,
      subject: template.subject,
      html: template.html,
    });
    console.log(`✉️ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Email error: ${error.message}`);
    return false;
  }
};

// Export functions
module.exports = {
  sendVerificationEmail: async (email, name, token) => {
    const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    return sendEmail(email, templates.verification(name, link));
  },

  sendResetPasswordEmail: async (email, name, token) => {
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    return sendEmail(email, templates.resetPassword(name, link));
  },

  sendTeamInviteEmail: async (email, teamName, inviterName, token) => {
    const link = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
    return sendEmail(email, templates.teamInvite(teamName, inviterName, link));
  },

  sendMonitorDownEmail: async (emails, monitorName, url, error, teamName) => {
    const template = templates.monitorDown(monitorName, url, error, teamName);
    return Promise.all(emails.map((email) => sendEmail(email, template)));
  },

  sendMonitorUpEmail: async (emails, monitorName, url, responseMs, teamName) => {
    const template = templates.monitorUp(monitorName, url, responseMs, teamName);
    return Promise.all(emails.map((email) => sendEmail(email, template)));
  },
};
