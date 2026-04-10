import { createServer } from "node:http";
import { app } from "./app.js";

import { Server } from 'socket.io';
const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server);

io.on('connection', (socket) => {
    console.log(`[+] User connected    | Socket ID: ${socket.id} | Total: ${io.engine.clientsCount}`);

    // Phase 4: Notify ALL OTHER clients that a new user joined
    socket.broadcast.emit('user:joined', {
        id: socket.id,
        totalUsers: io.engine.clientsCount,
    });

    // Phase 4: Send current user count to the newly connected client
    socket.emit('user:count', { totalUsers: io.engine.clientsCount });

    // Listen for 'chat:message' event from client
    socket.on('chat:message', (data) => {
        console.log(`[msg] ${socket.id}: ${data.text}`);

        const messageData = {
            text: data.text,
            sender: socket.id,
            timestamp: Date.now(),
        };

        // Phase 4: io.emit sends to ALL clients (including sender)
        io.emit('chat:message', messageData);
    });

    // Listen for 'ping:server' event — demonstrates acknowledgement (callback) pattern
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

        // Phase 4: Notify ALL remaining clients that a user left
        socket.broadcast.emit('user:left', {
            id: socket.id,
            totalUsers: io.engine.clientsCount,
        });
    });
});

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})