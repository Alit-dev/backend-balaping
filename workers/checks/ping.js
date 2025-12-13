/**
 * Ping Check Worker
 * Performs ICMP ping checks using TCP connection as fallback
 */

const net = require('net');
const dns = require('dns').promises;

/**
 * Perform ping check
 * Uses TCP connection to port 80/443 as ICMP requires raw sockets (root)
 */
async function checkPing(monitor) {
    const startTime = Date.now();
    let success = false;
    let responseMs = 0;
    let error = null;

    try {
        // Extract hostname from URL or use directly
        let host = monitor.url;
        if (host.includes('://')) {
            host = new URL(host).hostname;
        }

        // Resolve DNS first
        const addresses = await dns.resolve4(host).catch(() => null);
        if (!addresses || addresses.length === 0) {
            throw new Error('DNS resolution failed');
        }

        const ipAddress = addresses[0];

        // Try TCP connection to common ports
        const ports = [443, 80, 22];
        let connected = false;

        for (const port of ports) {
            try {
                await tcpPing(ipAddress, port, monitor.timeout || 10000);
                connected = true;
                break;
            } catch {
                // Try next port
            }
        }

        responseMs = Date.now() - startTime;

        if (connected) {
            success = true;
        } else {
            error = 'Host unreachable';
        }
    } catch (err) {
        responseMs = Date.now() - startTime;
        error = err.message || 'Ping failed';
        success = false;
    }

    return {
        success,
        responseMs,
        error,
    };
}

/**
 * TCP ping to a specific port
 */
function tcpPing(host, port, timeout) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let connected = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            connected = true;
            socket.destroy();
            resolve();
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Timeout'));
        });

        socket.on('error', (err) => {
            socket.destroy();
            reject(err);
        });

        socket.on('close', () => {
            if (!connected) {
                reject(new Error('Connection closed'));
            }
        });

        socket.connect(port, host);
    });
}

module.exports = { checkPing };
