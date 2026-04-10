import 'dotenv/config';

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'fallback-dev-secret',
        expiry: process.env.JWT_EXPIRY || '1h',
    },

    cors: {
        origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim()),
    },

    socketio: {
        pingInterval: parseInt(process.env.PING_INTERVAL || '25000', 10),
        pingTimeout: parseInt(process.env.PING_TIMEOUT || '20000', 10),
        maxDisconnectionDuration: parseInt(process.env.MAX_DISCONNECTION_DURATION || '120000', 10),
    },
} as const;
