import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import { registerUser, loginUser } from './auth.js';
import { config } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('http');

export const app = express();

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phase 10: Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],   // Needed for inline Socket.IO script
            connectSrc: ["'self'", "ws:", "wss:"],       // Allow WebSocket connections
        },
    },
}));

// Phase 10: CORS for REST endpoints
app.use(cors({ origin: config.cors.origins, credentials: true }));

// Parse JSON request bodies (limit size to prevent abuse)
app.use(express.json({ limit: '10kb' }));

// Phase 10: Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        log.info(`${req.method} ${req.path}`, {
            status: res.statusCode,
            ms: Date.now() - start,
        });
    });
    next();
});

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Phase 10: Health check endpoint (for load balancers / monitoring)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Phase 8: Auth REST endpoints — client gets a JWT token via HTTP, then connects WebSocket with it

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Username and password are required' });
        return;
    }

    const result = registerUser(username, password);
    res.status(result.success ? 201 : 400).json(result);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Username and password are required' });
        return;
    }

    const result = loginUser(username, password);
    res.status(result.success ? 200 : 401).json(result);
});