const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verify connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.log('⚠️ Email transporter error:', error.message);
    } else {
        console.log('✅ Email transporter ready');
    }
});

module.exports = transporter;
