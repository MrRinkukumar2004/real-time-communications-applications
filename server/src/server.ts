import { createServer } from "node:http";
import { app } from "./app.js";

import { Server } from 'socket.io';
const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server);

io.on('connection', (socket) => {
    console.log(`[+] User connected    | Socket ID: ${socket.id} | Total: ${io.engine.clientsCount}`);

    // Listen for 'chat:message' event from client
    socket.on('chat:message', (data) => {
        console.log(`[msg] ${socket.id}: ${data.text}`);

        // Send the message back to the SAME client (for now — broadcasting comes in Phase 4)
        socket.emit('chat:message', {
            text: data.text,
            sender: socket.id,
            timestamp: Date.now(),
        });
    });

    // Listen for 'ping:server' event — demonstrates acknowledgement (callback) pattern
    socket.on('ping:server', (data, callback) => {
        console.log(`[ping] from ${socket.id}:`, data);

        // Call the callback to send an acknowledgement back to the client
        callback({
            status: 'ok',
            message: 'pong from server!',
            receivedAt: Date.now(),
        });
    });

    socket.on('disconnect', (reason) => {
        console.log(`[-] User disconnected | Socket ID: ${socket.id} | Reason: ${reason} | Total: ${io.engine.clientsCount}`);
    });
});

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})