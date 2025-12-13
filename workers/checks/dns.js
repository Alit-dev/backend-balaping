/**
 * DNS Check Worker
 * Checks DNS resolution and validates records
 */

const dns = require('dns').promises;

/**
 * Perform DNS check
 */
async function checkDns(monitor) {
    const startTime = Date.now();
    let success = false;
    let responseMs = 0;
    let error = null;
    let resolvedValue = null;

    try {
        // Extract hostname from URL
        let hostname = monitor.url;
        if (hostname.includes('://')) {
            hostname = new URL(hostname).hostname;
        }

        const recordType = monitor.dnsRecordType || 'A';
        const expectedValue = monitor.dnsExpectedValue;

        // Resolve the DNS record
        let records;
        switch (recordType.toUpperCase()) {
            case 'A':
                records = await dns.resolve4(hostname);
                break;
            case 'AAAA':
                records = await dns.resolve6(hostname);
                break;
            case 'MX':
                records = await dns.resolveMx(hostname);
                records = records.map(r => `${r.priority} ${r.exchange}`);
                break;
            case 'CNAME':
                records = await dns.resolveCname(hostname);
                break;
            case 'TXT':
                records = await dns.resolveTxt(hostname);
                records = records.flat();
                break;
            case 'NS':
                records = await dns.resolveNs(hostname);
                break;
            case 'SOA':
                const soa = await dns.resolveSoa(hostname);
                records = [`${soa.nsname} ${soa.hostmaster}`];
                break;
            default:
                throw new Error(`Unsupported record type: ${recordType}`);
        }

        responseMs = Date.now() - startTime;
        resolvedValue = Array.isArray(records) ? records.join(', ') : records;

        // If expected value is set, validate
        if (expectedValue) {
            const found = records.some(r =>
                String(r).toLowerCase().includes(expectedValue.toLowerCase())
            );
            if (!found) {
                error = `Expected "${expectedValue}" not found in ${resolvedValue}`;
                success = false;
            } else {
                success = true;
            }
        } else {
            // Just check if DNS resolves
            success = records && records.length > 0;
        }
    } catch (err) {
        responseMs = Date.now() - startTime;
        if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
            error = `DNS record not found`;
        } else if (err.code === 'ETIMEOUT') {
            error = 'DNS timeout';
        } else {
            error = err.message || 'DNS check failed';
        }
        success = false;
    }

    return {
        success,
        responseMs,
        error,
        resolvedValue,
    };
}

module.exports = { checkDns };
