import { createServer } from "node:http";
import { app } from "./app.js";
import { verifyToken } from './auth.js';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';

const log = createLogger('socket');
const logRedis = createLogger('redis');
const logServer = createLogger('server');

const server = createServer(app);

// Socket.IO — uses config for all settings
const io = new Server(server, {
    cors: {
        origin: config.cors.origins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingInterval: config.socketio.pingInterval,
    pingTimeout: config.socketio.pingTimeout,
    connectionStateRecovery: {
        maxDisconnectionDuration: config.socketio.maxDisconnectionDuration,
        skipMiddlewares: true,
    },
});

// Redis Adapter
const pubClient = new Redis(config.redis.url);
const subClient = pubClient.duplicate();

pubClient.on('connect', () => logRedis.info('Pub client connected'));
subClient.on('connect', () => logRedis.info('Sub client connected'));
pubClient.on('error', (err) => logRedis.error('Pub client error', { message: err.message }));
subClient.on('error', (err) => logRedis.error('Sub client error', { message: err.message }));

io.adapter(createAdapter(pubClient, subClient));

// Available rooms
const ROOMS = ['general', 'tech', 'random'];

async function getRoomUsers(room: string) {
    const sockets = await io.in(room).fetchSockets();
    return sockets.map((s) => ({
        id: s.id,
        username: s.data.username || 'Anonymous',
    }));
}

async function broadcastRoomUsers(room: string) {
    const users = await getRoomUsers(room);
    io.to(room).emit('room:users', { room, users });
}

// ──── Middleware ────

// Middleware 1: Logging
io.use((socket, next) => {
    log.info('Connection attempt', {
        ip: socket.handshake.address,
        transport: socket.conn.transport.name,
    });
    next();
});

// Middleware 2: Rate limiting
const connectionTimestamps = new Map<string, number[]>();

io.use((socket, next) => {
    const clientIp = socket.handshake.address;
    const now = Date.now();
    const windowMs = 60_000;
    const maxConnections = 10;

    const timestamps = connectionTimestamps.get(clientIp) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < windowMs);
    recentTimestamps.push(now);
    connectionTimestamps.set(clientIp, recentTimestamps);

    if (recentTimestamps.length > maxConnections) {
        log.warn('Rate limited', { ip: clientIp, count: recentTimestamps.length });
        next(new Error('Too many connection attempts. Please try again later.'));
        return;
    }

    next();
});

// Middleware 3: JWT Authentication
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        log.warn('No token provided', { socketId: socket.id });
        next(new Error('Authentication required. Please login first.'));
        return;
    }

    const result = verifyToken(token);

    if (!result.valid || !result.payload) {
        log.warn('Invalid token', { socketId: socket.id, reason: result.message });
        next(new Error(`Authentication failed: ${result.message}`));
        return;
    }

    socket.data.username = result.payload.username;
    log.info('Authenticated', { username: result.payload.username });
    next();
});

// ──── Connection handler ────

io.on('connection', async (socket) => {
    const username = socket.data.username;
    log.info('User connected', { username, socketId: socket.id, recovered: socket.recovered, total: io.engine.clientsCount });

    if (socket.recovered) {
        const room = socket.data.currentRoom;
        log.info('Session recovered', { username, room });

        socket.emit('connection:recovered', { username, room });

        if (room) {
            socket.to(room).emit('user:joined', { id: socket.id, username, room });
            broadcastRoomUsers(room);
        }
        return;
    }

    // Auto-join 'general'
    socket.emit('room:list', { rooms: ROOMS });
    socket.join('general');
    socket.data.currentRoom = 'general';

    socket.to('general').emit('user:joined', { id: socket.id, username, room: 'general' });
    const users = await getRoomUsers('general');
    socket.emit('room:joined', { room: 'general', users });
    broadcastRoomUsers('general');

    // Join a room
    socket.on('room:join', async (data, callback) => {
        const newRoom = data.room;
        const oldRoom = socket.data.currentRoom;
        const username = socket.data.username || 'Anonymous';

        if (!ROOMS.includes(newRoom)) {
            callback({ status: 'error', message: `Room "${newRoom}" does not exist` });
            return;
        }
        if (oldRoom === newRoom) {
            callback({ status: 'error', message: `Already in room "${newRoom}"` });
            return;
        }

        socket.leave(oldRoom);
        socket.to(oldRoom).emit('user:left', { id: socket.id, username, room: oldRoom });
        broadcastRoomUsers(oldRoom);

        socket.join(newRoom);
        socket.data.currentRoom = newRoom;
        socket.to(newRoom).emit('user:joined', { id: socket.id, username, room: newRoom });

        const users = await getRoomUsers(newRoom);
        callback({ status: 'ok', room: newRoom, users });
        broadcastRoomUsers(newRoom);

        log.info('Room switch', { username, from: oldRoom, to: newRoom });
    });

    // Chat message
    socket.on('chat:message', (data) => {
        if (!socket.data.username) {
            socket.emit('error:auth', { message: 'You must set a username before sending messages' });
            return;
        }

        const room = socket.data.currentRoom;
        const username = socket.data.username;

        if (!data || typeof data.text !== 'string' || data.text.trim().length === 0) return;

        const text = data.text.trim().slice(0, 500);
        log.debug('Message', { room, username, text: text.slice(0, 50) });

        io.to(room).emit('chat:message', {
            text,
            sender: socket.id,
            username,
            room,
            timestamp: Date.now(),
        });
    });

    // Typing indicator
    socket.on('user:typing', (data) => {
        if (!socket.data.username || !socket.data.currentRoom) return;
        socket.to(socket.data.currentRoom).emit('user:typing', {
            id: socket.id,
            username: socket.data.username,
            isTyping: data.isTyping,
        });
    });

    // Ping/pong
    socket.on('ping:server', (data, callback) => {
        callback({ status: 'ok', message: 'pong from server!', receivedAt: Date.now() });
    });

    socket.on('disconnecting', (reason) => {
        log.debug('Disconnecting', { username: socket.data.username, reason, rooms: [...socket.rooms].join(', ') });
    });

    socket.on('disconnect', (reason) => {
        const username = socket.data.username || 'Anonymous';
        log.info('User disconnected', { username, socketId: socket.id, reason, total: io.engine.clientsCount });

        const room = socket.data.currentRoom;
        if (room) {
            socket.to(room).emit('user:left', { id: socket.id, username, room });
            broadcastRoomUsers(room);
        }
    });
});

// Engine-level error handler
io.engine.on('connection_error', (err: { req: unknown; code: number; message: string; context: unknown }) => {
    log.error('Engine connection error', { code: err.code, message: err.message });
});

// ──── Phase 10: Graceful Shutdown ────

async function gracefulShutdown(signal: string) {
    logServer.info(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(() => {
        logServer.info('HTTP server closed');
    });

    // 2. Notify all connected clients
    io.emit('server:shutdown', { message: 'Server is restarting. You will be reconnected automatically.' });

    // 3. Close all socket connections
    const sockets = await io.fetchSockets();
    logServer.info(`Disconnecting ${sockets.length} sockets...`);
    for (const s of sockets) {
        s.disconnect(true);
    }

    // 4. Close Socket.IO server
    io.close(() => {
        logServer.info('Socket.IO server closed');
    });

    // 5. Close Redis connections
    try {
        await pubClient.quit();
        await subClient.quit();
        logRedis.info('Redis connections closed');
    } catch (err) {
        logRedis.error('Error closing Redis', { message: (err as Error).message });
    }

    logServer.info('Graceful shutdown complete');
    process.exit(0);
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled errors (don't crash the server)
process.on('uncaughtException', (err) => {
    logServer.error('Uncaught exception', { message: err.message, stack: err.stack });
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logServer.error('Unhandled rejection', { reason: String(reason) });
});

// ──── Start server ────

server.listen(config.port, () => {
    logServer.info(`Server running`, {
        port: config.port,
        env: config.nodeEnv,
        pid: process.pid,
        url: `http://localhost:${config.port}`,
    });
});
