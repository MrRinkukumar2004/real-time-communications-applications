import { config } from './config.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatLog(level: LogLevel, context: string, message: string, data?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    if (config.isProduction) {
        // JSON format for production (parseable by log aggregators)
        const entry = { timestamp, level, pid, context, message, ...data };
        return JSON.stringify(entry);
    }

    // Human-readable format for development
    const prefix = `[${timestamp.slice(11, 19)}] [${level.toUpperCase().padEnd(5)}] [${context}]`;
    const dataStr = data ? ` | ${Object.entries(data).map(([k, v]) => `${k}=${v}`).join(' ')}` : '';
    return `${prefix} ${message}${dataStr}`;
}

export function createLogger(context: string) {
    return {
        info(message: string, data?: Record<string, unknown>) {
            console.log(formatLog('info', context, message, data));
        },
        warn(message: string, data?: Record<string, unknown>) {
            console.warn(formatLog('warn', context, message, data));
        },
        error(message: string, data?: Record<string, unknown>) {
            console.error(formatLog('error', context, message, data));
        },
        debug(message: string, data?: Record<string, unknown>) {
            if (!config.isProduction) {
                console.debug(formatLog('debug', context, message, data));
            }
        },
    };
}
