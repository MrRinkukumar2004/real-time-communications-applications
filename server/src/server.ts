import { createServer } from "node:http";
import { app } from "./app.js";

import { Server } from 'socket.io';
const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server);

io.on('connection', (socket) => {
    console.log(`[+] User connected    | Socket ID: ${socket.id} | Total: ${io.engine.clientsCount}`);

    socket.on('disconnect', (reason) => {
        console.log(`[-] User disconnected | Socket ID: ${socket.id} | Reason: ${reason} | Total: ${io.engine.clientsCount}`);
    });
});

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})