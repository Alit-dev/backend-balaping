const { Resend } = require('resend');

const resend = new Resend("re_GeWwoH8k_7sZcshiAeNcjN4FA29RE2Uup")

async function sendMail({ to, subject, html, text }) {
    try {
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev'
            to,
            subject,
            html,
            text,
        });

        console.log('✅ Email sent:', data.id);
        return true;
    } catch (error) {
        console.error('⚠️ Email error:', error.message);
        return false;
    }
}

module.exports = sendMail;

