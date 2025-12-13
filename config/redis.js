/**
 * Redis Configuration
 * Provides Redis connection for BullMQ and caching
 */

const Redis = require('ioredis');

// Redis connection configuration
const redisConfig = process.env.REDIS_URL
    ? process.env.REDIS_URL
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
        retryStrategy: (times) => {
            if (times > 10) {
                console.error('Redis connection failed after 10 retries');
                return null;
            }
            return Math.min(times * 200, 2000);
        },
    };

// Create Redis connection
let redisClient = null;
let redisSubscriber = null;

function getRedisClient() {
    if (!redisClient) {
        redisClient = new Redis(redisConfig);

        redisClient.on('connect', () => {
            console.log('✅ Redis connected');
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
        });

        redisClient.on('close', () => {
            console.log('Redis connection closed');
        });
    }
    return redisClient;
}

function getRedisSubscriber() {
    if (!redisSubscriber) {
        redisSubscriber = new Redis(redisConfig);
    }
    return redisSubscriber;
}

// Graceful shutdown
async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
    if (redisSubscriber) {
        await redisSubscriber.quit();
        redisSubscriber = null;
    }
}

module.exports = {
    redisConfig,
    getRedisClient,
    getRedisSubscriber,
    closeRedis,
};
