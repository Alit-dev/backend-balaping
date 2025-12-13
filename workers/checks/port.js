/**
 * Port Check Worker
 * Checks if a TCP/UDP port is open
 */

const net = require('net');
const dgram = require('dgram');

/**
 * Perform port check
 */
async function checkPort(monitor) {
    const startTime = Date.now();
    let success = false;
    let responseMs = 0;
    let error = null;

    try {
        // Extract host from URL
        let host = monitor.url;
        if (host.includes('://')) {
            host = new URL(host).hostname;
        }

        const port = monitor.port;
        const protocol = monitor.portProtocol || 'tcp';
        const timeout = monitor.timeout || 10000;

        if (!port) {
            throw new Error('Port not specified');
        }

        if (protocol === 'tcp') {
            await checkTcpPort(host, port, timeout);
            success = true;
        } else if (protocol === 'udp') {
            await checkUdpPort(host, port, timeout);
            success = true;
        } else {
            throw new Error(`Unknown protocol: ${protocol}`);
        }

        responseMs = Date.now() - startTime;
    } catch (err) {
        responseMs = Date.now() - startTime;
        error = err.message || 'Port check failed';
        success = false;
    }

    return {
        success,
        responseMs,
        error,
    };
}

/**
 * Check TCP port
 */
function checkTcpPort(host, port, timeout) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            resolve();
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error(`Port ${port} timeout`));
        });

        socket.on('error', (err) => {
            socket.destroy();
            if (err.code === 'ECONNREFUSED') {
                reject(new Error(`Port ${port} closed`));
            } else {
                reject(new Error(`Port ${port}: ${err.message}`));
            }
        });

        socket.connect(port, host);
    });
}

/**
 * Check UDP port
 * Note: UDP is connectionless, so we can only check if the port responds
 */
function checkUdpPort(host, port, timeout) {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        let received = false;

        const timer = setTimeout(() => {
            if (!received) {
                client.close();
                // UDP doesn't guarantee response, so timeout might mean port is open but not responding
                // We'll treat timeout as success for UDP (port might be filtered but not closed)
                resolve();
            }
        }, timeout);

        client.on('message', () => {
            received = true;
            clearTimeout(timer);
            client.close();
            resolve();
        });

        client.on('error', (err) => {
            clearTimeout(timer);
            client.close();
            if (err.code === 'ECONNREFUSED') {
                reject(new Error(`UDP port ${port} refused`));
            } else {
                reject(new Error(`UDP port ${port}: ${err.message}`));
            }
        });

        // Send empty packet
        client.send(Buffer.alloc(0), port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                client.close();
                reject(new Error(`UDP send failed: ${err.message}`));
            }
        });
    });
}

module.exports = { checkPort };
