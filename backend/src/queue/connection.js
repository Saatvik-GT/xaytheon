const IORedis = require('ioredis');

// Default Redis configuration
const connection = new IORedis({
    host: process.env.REDIS_HOST || (() => { throw new Error('REDIS_HOST not set'); })(),
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: true } : undefined,
    maxRetriesPerRequest: 5, // Bounded retries for safety
    connectTimeout: 5000,
    enableReadyCheck: true,
    retryStrategy(times) {
        // Exponential backoff with jitter
        if (times > 10) {
            console.error('⚠️  Redis unavailable — stopping retries');
            return null; // Stop retrying
        }
        const delay = Math.min(2 ** times * 100, 30000);
        const jitter = Math.floor(Math.random() * 1000);
        return delay + jitter;
    },
    lazyConnect: false, // Suppress noisy reconnect logs
});

let redisErrorLogged = false;

connection.on('connect', () => {
    console.log('✅ Redis connected');
    redisErrorLogged = false;
});

connection.on('error', (err) => {
    // Rate-limited logging for repeated errors
    if (!redisErrorLogged) {
        console.error('⚠️  Redis error:', err.code || err.message);
        redisErrorLogged = true;
        setTimeout(() => { redisErrorLogged = false; }, 5000); // Reset logging flag every 5s
    }
});

connection.on('close', () => {
    console.warn('⚠️  Redis connection closed');
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
    try {
        console.log('🛑 Closing Redis connection...');
        await connection.quit();
        console.log('✅ Redis connection closed gracefully');
    } catch (err) {
        console.error('⚠️ Error closing Redis:', err.message);
    } finally {
        process.exit(0);
    }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = connection;
