/**
 * Keyword Check Worker
 * Performs HTTP request and checks for keyword presence
 */

const axios = require('axios');

/**
 * Perform keyword check
 */
async function checkKeyword(monitor) {
    const startTime = Date.now();
    let success = false;
    let statusCode = null;
    let responseMs = 0;
    let error = null;
    let keywordFound = false;

    try {
        const response = await axios({
            method: monitor.method || 'GET',
            url: monitor.url,
            timeout: monitor.timeout || 30000,
            headers: monitor.headers || {},
            validateStatus: () => true,
        });

        responseMs = Date.now() - startTime;
        statusCode = response.status;

        // Check if response is successful
        if (statusCode < 200 || statusCode >= 400) {
            error = `HTTP ${statusCode}`;
            success = false;
        } else {
            // Get response body as text
            const body = typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data);

            const keyword = monitor.keyword;
            const keywordType = monitor.keywordType || 'contains';

            if (!keyword) {
                error = 'No keyword specified';
                success = false;
            } else {
                // Case-insensitive search
                keywordFound = body.toLowerCase().includes(keyword.toLowerCase());

                if (keywordType === 'contains') {
                    success = keywordFound;
                    if (!success) {
                        error = `Keyword "${keyword}" not found`;
                    }
                } else if (keywordType === 'not_contains') {
                    success = !keywordFound;
                    if (!success) {
                        error = `Keyword "${keyword}" found (should not be present)`;
                    }
                }
            }
        }
    } catch (err) {
        responseMs = Date.now() - startTime;
        error = err.code || err.message || 'Request failed';
        success = false;
    }

    return {
        success,
        statusCode,
        responseMs,
        error,
        keywordFound,
    };
}

module.exports = { checkKeyword };
