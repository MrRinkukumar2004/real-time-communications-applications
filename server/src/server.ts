import { createServer } from "node:http";
import { app } from "./app.js";

import { Server } from 'socket.io';
const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server);

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

io.on('connection', (socket) => {
    console.log(`[+] User connected    | Socket ID: ${socket.id} | Total: ${io.engine.clientsCount}`);

    // Phase 6: Set username (must be done before joining room)
    socket.on('user:set-name', async (data, callback) => {
        const username = data.username?.trim();

        if (!username || username.length < 2 || username.length > 20) {
            callback({ status: 'error', message: 'Username must be 2-20 characters' });
            return;
        }

        socket.data.username = username;
        console.log(`[user] ${socket.id} set username: "${username}"`);

        // Send available rooms list
        socket.emit('room:list', { rooms: ROOMS });

        // Auto-join 'general'
        socket.join('general');
        socket.data.currentRoom = 'general';
        console.log(`[room] ${username} joined "general"`);

        // Notify others in 'general'
        socket.to('general').emit('user:joined', { id: socket.id, username, room: 'general' });

        // Send room info to the client
        const users = await getRoomUsers('general');
        socket.emit('room:joined', { room: 'general', users });

        // Broadcast updated users list to everyone in 'general'
        broadcastRoomUsers('general');

        callback({ status: 'ok', username });
    });

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
        const room = socket.data.currentRoom;
        const username = socket.data.username || 'Anonymous';
        console.log(`[msg] [${room}] ${username}: ${data.text}`);

        const messageData = {
            text: data.text,
            sender: socket.id,
            username,
            room,
            timestamp: Date.now(),
        };

        io.to(room).emit('chat:message', messageData);
    });

    // Phase 6: Typing indicator
    socket.on('user:typing', (data) => {
        const room = socket.data.currentRoom;
        const username = socket.data.username || 'Anonymous';

        // Broadcast to everyone in room EXCEPT sender
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

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})