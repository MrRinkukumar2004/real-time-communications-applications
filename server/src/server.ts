import { createServer } from "node:http";
import { app } from "./app.js";

import { Server } from 'socket.io';
const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server);

// Available rooms
const ROOMS = ['general', 'tech', 'random'];

// Helper: get number of users in a specific room
async function getRoomSize(room: string): Promise<number> {
    const sockets = await io.in(room).fetchSockets();
    return sockets.length;
}

io.on('connection', (socket) => {
    console.log(`[+] User connected    | Socket ID: ${socket.id} | Total: ${io.engine.clientsCount}`);

    // Send available rooms list to the new client
    socket.emit('room:list', { rooms: ROOMS });

    // Auto-join the 'general' room on connect
    socket.join('general');
    socket.data.currentRoom = 'general';
    console.log(`[room] ${socket.id} joined "general"`);

    // Notify others in 'general' that a new user joined
    socket.to('general').emit('user:joined', { id: socket.id, room: 'general' });

    // Send room info to the newly connected client
    getRoomSize('general').then((size) => {
        socket.emit('room:joined', { room: 'general', userCount: size });
    });

    // Phase 5: Join a room
    socket.on('room:join', async (data, callback) => {
        const newRoom = data.room;
        const oldRoom = socket.data.currentRoom;

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
        socket.to(oldRoom).emit('user:left', { id: socket.id, room: oldRoom });
        console.log(`[room] ${socket.id} left "${oldRoom}"`);

        // Join new room
        socket.join(newRoom);
        socket.data.currentRoom = newRoom;
        socket.to(newRoom).emit('user:joined', { id: socket.id, room: newRoom });
        console.log(`[room] ${socket.id} joined "${newRoom}"`);

        const userCount = await getRoomSize(newRoom);
        callback({ status: 'ok', room: newRoom, userCount });
    });

    // Phase 5: Chat message — now scoped to the sender's current room
    socket.on('chat:message', (data) => {
        const room = socket.data.currentRoom;
        console.log(`[msg] [${room}] ${socket.id}: ${data.text}`);

        const messageData = {
            text: data.text,
            sender: socket.id,
            room,
            timestamp: Date.now(),
        };

        // Send to everyone in the room (including sender)
        io.to(room).emit('chat:message', messageData);
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
        console.log(`[-] User disconnected | Socket ID: ${socket.id} | Reason: ${reason} | Total: ${io.engine.clientsCount}`);

        const room = socket.data.currentRoom;
        if (room) {
            socket.to(room).emit('user:left', { id: socket.id, room });
        }
    });
});

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})