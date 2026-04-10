import { createServer } from "node:http";
import { app } from "./app.js";
import { verifyToken } from './auth.js';

import { Server } from 'socket.io';
const port = process.env.PORT || 3000;
const server = createServer(app);

// Phase 8: Configure Socket.IO with CORS + connection options
const io = new Server(server, {
    // CORS configuration — which origins can connect via WebSocket
    cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Allowed origins
        methods: ['GET', 'POST'],        // Allowed HTTP methods for handshake
        credentials: true,                // Allow cookies/auth headers
    },

    // Heartbeat config
    pingInterval: 25000,
    pingTimeout: 20000,

    // Connection state recovery
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
    },
});

// Available rooms
const ROOMS = ['general', 'tech', 'random'];

// Helper: get users list in a specific room (with usernames)
async function getRoomUsers(room: string) {
    const sockets = await io.in(room).fetchSockets();
    return sockets.map((s) => ({
        id: s.id,
        username: s.data.username || 'Anonymous',
    }));
}

// Helper: broadcast updated users list to everyone in a room
async function broadcastRoomUsers(room: string) {
    const users = await getRoomUsers(room);
    io.to(room).emit('room:users', { room, users });
}

// ──── Phase 7: Server-side middleware ────

// Middleware 1: Logging
io.use((socket, next) => {
    const clientIp = socket.handshake.address;
    const transport = socket.conn.transport.name;
    console.log(`[middleware:log] Connection attempt | IP: ${clientIp} | Transport: ${transport}`);
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
        console.log(`[middleware:rate] Rate limited: ${clientIp}`);
        next(new Error('Too many connection attempts. Please try again later.'));
        return;
    }

    next();
});

// Phase 8: Middleware 3: JWT Authentication
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        console.log(`[middleware:auth] No token provided | Socket: ${socket.id}`);
        next(new Error('Authentication required. Please login first.'));
        return;
    }

    const result = verifyToken(token);

    if (!result.valid || !result.payload) {
        console.log(`[middleware:auth] Invalid token | Socket: ${socket.id} | Reason: ${result.message}`);
        next(new Error(`Authentication failed: ${result.message}`));
        return;
    }

    // Attach the authenticated username to socket.data
    socket.data.username = result.payload.username;
    console.log(`[middleware:auth] Authenticated: ${result.payload.username}`);
    next();
});

io.on('connection', async (socket) => {
    const username = socket.data.username; // Set by JWT middleware
    console.log(`[+] ${username} connected | Socket ID: ${socket.id} | Recovered: ${socket.recovered} | Total: ${io.engine.clientsCount}`);

    // Phase 7: If the connection was recovered, restore state
    if (socket.recovered) {
        const room = socket.data.currentRoom;
        console.log(`[recovery] ${username} recovered in room "${room}"`);

        socket.emit('connection:recovered', {
            username: socket.data.username,
            room: socket.data.currentRoom,
        });

        if (room) {
            socket.to(room).emit('user:joined', { id: socket.id, username, room });
            broadcastRoomUsers(room);
        }
        return;
    }

    // Phase 8: Username is already set by JWT middleware — auto-join 'general'
    socket.emit('room:list', { rooms: ROOMS });

    socket.join('general');
    socket.data.currentRoom = 'general';
    console.log(`[room] ${username} joined "general"`);

    socket.to('general').emit('user:joined', { id: socket.id, username, room: 'general' });

    const users = await getRoomUsers('general');
    socket.emit('room:joined', { room: 'general', users });
    broadcastRoomUsers('general');

    // Phase 5: Join a room
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

        // Leave old room
        socket.leave(oldRoom);
        socket.to(oldRoom).emit('user:left', { id: socket.id, username, room: oldRoom });
        broadcastRoomUsers(oldRoom);
        console.log(`[room] ${username} left "${oldRoom}"`);

        // Join new room
        socket.join(newRoom);
        socket.data.currentRoom = newRoom;
        socket.to(newRoom).emit('user:joined', { id: socket.id, username, room: newRoom });
        console.log(`[room] ${username} joined "${newRoom}"`);

        const users = await getRoomUsers(newRoom);
        callback({ status: 'ok', room: newRoom, users });

        // Broadcast updated users list to everyone in new room
        broadcastRoomUsers(newRoom);
    });

    // Chat message — scoped to the sender's current room
    socket.on('chat:message', (data) => {
        // Phase 7: Guard — must have username set
        if (!socket.data.username) {
            socket.emit('error:auth', { message: 'You must set a username before sending messages' });
            return;
        }

        const room = socket.data.currentRoom;
        const username = socket.data.username;

        // Phase 7: Validate message data
        if (!data || typeof data.text !== 'string' || data.text.trim().length === 0) {
            return; // Silently ignore invalid messages
        }

        const text = data.text.trim().slice(0, 500); // Limit message length to 500 chars
        console.log(`[msg] [${room}] ${username}: ${text}`);

        const messageData = {
            text,
            sender: socket.id,
            username,
            room,
            timestamp: Date.now(),
        };

        io.to(room).emit('chat:message', messageData);
    });

    // Phase 6: Typing indicator
    socket.on('user:typing', (data) => {
        if (!socket.data.username || !socket.data.currentRoom) return;

        const room = socket.data.currentRoom;
        const username = socket.data.username;

        socket.to(room).emit('user:typing', {
            id: socket.id,
            username,
            isTyping: data.isTyping,
        });
    });

    // Ping/pong acknowledgement (Phase 3)
    socket.on('ping:server', (data, callback) => {
        console.log(`[ping] from ${socket.id}:`, data);

        callback({
            status: 'ok',
            message: 'pong from server!',
            receivedAt: Date.now(),
        });
    });

    // Phase 7: Handle the 'disconnecting' event — fires BEFORE leaving rooms
    socket.on('disconnecting', (reason) => {
        const username = socket.data.username || 'Anonymous';
        console.log(`[~] ${username} disconnecting | Reason: ${reason} | Rooms: ${[...socket.rooms].join(', ')}`);
        // socket.rooms is still available here — the socket hasn't left yet
    });

    socket.on('disconnect', (reason) => {
        const username = socket.data.username || 'Anonymous';
        console.log(`[-] ${username} disconnected | Socket ID: ${socket.id} | Reason: ${reason} | Total: ${io.engine.clientsCount}`);

        const room = socket.data.currentRoom;
        if (room) {
            socket.to(room).emit('user:left', { id: socket.id, username, room });
            broadcastRoomUsers(room);
        }
    });
});

// Phase 7: Global error handler — catches unhandled errors in event handlers
io.engine.on('connection_error', (err: { req: unknown; code: number; message: string; context: unknown }) => {
    console.error(`[engine] Connection error: code=${err.code} message=${err.message}`);
});

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})