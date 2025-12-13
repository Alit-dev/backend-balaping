/**
 * HTTP(S) Check Worker
 * Performs HTTP requests and validates response
 */

const axios = require('axios');
const https = require('https');
const tls = require('tls');

/**
 * Perform HTTP check
 */
async function checkHttp(monitor) {
    const startTime = Date.now();
    let success = false;
    let statusCode = null;
    let responseMs = 0;
    let error = null;
    let sslInfo = null;

    try {
        const response = await axios({
            method: monitor.method || 'GET',
            url: monitor.url,
            timeout: monitor.timeout || 30000,
            headers: monitor.headers || {},
            data: monitor.method === 'POST' || monitor.method === 'PUT' ? monitor.body : undefined,
            validateStatus: () => true, // Don't throw on any status code
            // For SSL check
            httpsAgent: monitor.sslCheck ? new https.Agent({
                rejectUnauthorized: false,
            }) : undefined,
        });

        responseMs = Date.now() - startTime;
        statusCode = response.status;
        success = statusCode === (monitor.expectedCode || 200);

        if (!success) {
            error = `Expected ${monitor.expectedCode || 200}, got ${statusCode}`;
        }

        // Get SSL certificate info if enabled
        if (monitor.sslCheck && monitor.url.startsWith('https://')) {
            sslInfo = await getSslInfo(monitor.url);
        }
    } catch (err) {
        responseMs = Date.now() - startTime;
        error = err.code || err.message || 'Connection failed';
        success = false;
    }

    return {
        success,
        statusCode,
        responseMs,
        error,
        sslInfo,
    };
}

/**
 * Get SSL certificate information
 */
async function getSslInfo(url) {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(url);
            const options = {
                host: urlObj.hostname,
                port: urlObj.port || 443,
                servername: urlObj.hostname,
                rejectUnauthorized: false,
            };

            const socket = tls.connect(options, () => {
                const cert = socket.getPeerCertificate();
                socket.destroy();

                if (!cert || !cert.valid_to) {
                    resolve(null);
                    return;
                }

                const expiryDate = new Date(cert.valid_to);
                const now = new Date();
                const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

                resolve({
                    expiresAt: expiryDate,
                    daysRemaining,
                    issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
                    subject: cert.subject?.CN || 'Unknown',
                    valid: daysRemaining > 0,
                });
            });

            socket.on('error', () => {
                resolve(null);
            });

            socket.setTimeout(5000, () => {
                socket.destroy();
                resolve(null);
            });
        } catch {
            resolve(null);
        }
    });
}

module.exports = { checkHttp, getSslInfo };
