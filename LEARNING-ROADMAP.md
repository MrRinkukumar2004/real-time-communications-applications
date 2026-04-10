# Real-Time Communication App — Learning Roadmap

## Full Phase Plan

| Phase | Topic | Status |
|-------|-------|--------|
| **Phase 1** | Project Setup — Express + HTTP Server + Socket.IO | Done |
| **Phase 2** | Serving HTML Client & First Client-Server Connection | Done |
| **Phase 3** | Emitting & Listening to Events (messaging basics) | Done |
| **Phase 4** | Broadcasting — Send messages to all/other users | Done |
| **Phase 5** | Rooms & Namespaces — Group chats, channels | Done |
| **Phase 6** | User Tracking — Online users, nicknames, typing indicator | Done |
| **Phase 7** | Disconnect & Error Handling | Done |
| **Phase 8** | CORS, Middleware & Authentication for WebSockets | Pending |
| **Phase 9** | Scaling — Redis adapter, multiple instances | Pending |
| **Phase 10** | Production Deployment & Best Practices | Pending |

---

## Phase 1: Project Setup (Express + HTTP Server + Socket.IO)

### What was done

We created a Node.js + TypeScript project with the following structure:

```
server/
├── src/
│   ├── app.ts        ← Express app with REST routes
│   └── server.ts     ← HTTP server + Socket.IO setup
├── tsconfig.json     ← TypeScript configuration
└── package.json      ← Dependencies & scripts
```

**Files created:**

**`app.ts`** — A basic Express instance with a health-check route:

```ts
import express from 'express';

export const app = express();

app.get('/', (req, res) => {
    res.send(`Real time application running ...`)
})
```

**`server.ts`** — Wraps Express in an HTTP server and attaches Socket.IO:

```ts
import { createServer } from "node:http";
import { app } from "./app.js";
import { Server } from 'socket.io';

const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server);
io.on('connection', (socket) => {
    console.log('a user connected');
});

server.listen(port, () => {
    console.log(`\nReal time communications application is running on : http://localhost:${port} `)
})
```

**Key dependencies installed:**

- `express` — Web framework for REST routes
- `socket.io` — Real-time bidirectional event-based communication
- `typescript` — Type safety
- `nodemon` — Hot reload during development

---

### How it works

```
Client (browser)
    |
    |  HTTP request → Express handles normal routes (GET /)
    |
    |  WebSocket upgrade → Socket.IO handles real-time connection
    |
    ▼
node:http.createServer(app)  ← single HTTP server serves both
    |
    ├── Express (app.ts)       ← REST routes
    └── Socket.IO (server.ts)  ← WebSocket events
```

#### Connection Flow:

1. **Client sends HTTP request** with `Upgrade: websocket` header
2. **Server accepts the upgrade** → persistent bidirectional connection is established
3. **`io.on('connection', callback)`** fires for each new client
4. The **`socket` object** represents that one client's connection

#### Why `createServer(app)` instead of `app.listen()`?

`app.listen()` internally calls `createServer(app).listen()` but **doesn't expose** the `http.Server` instance. Socket.IO needs the raw HTTP server to intercept WebSocket upgrade requests. By creating it manually, we can pass it to both Express and Socket.IO.

#### HTTP vs WebSocket:

| Feature | HTTP | WebSocket |
|---------|------|-----------|
| Direction | Client → Server (request-response) | Bidirectional (full-duplex) |
| Connection | Opens and closes per request | Persistent, stays open |
| Overhead | Headers sent every request | Minimal after handshake |
| Use case | REST APIs, page loads | Chat, live updates, gaming |

#### Why Socket.IO over raw WebSocket?

Raw WebSocket is just a transport protocol. Socket.IO adds:
- **Automatic reconnection** if connection drops
- **Fallback to HTTP long-polling** if WebSocket isn't available
- **Rooms & Namespaces** for organizing connections
- **Event-based communication** (`emit` / `on` pattern)
- **Acknowledgements** (confirm message received)
- **Binary support** (send files, images)

---

### Interview Questions

**Q1: Why do we need `createServer(app)` instead of just `app.listen()`?**

> `app.listen()` internally calls `http.createServer(app).listen()` but doesn't return or expose the HTTP server instance in a way we can use. Socket.IO needs the raw `http.Server` object to intercept the WebSocket upgrade handshake. By creating the server manually with `createServer(app)`, we get a reference we can pass to both Express (for REST routes) and Socket.IO (for WebSocket connections).

---

**Q2: What is the difference between HTTP and WebSocket protocol?**

> **HTTP** is a request-response (half-duplex) protocol — the client sends a request, the server responds, and the connection typically closes. Each interaction requires a new request.
>
> **WebSocket** is a full-duplex protocol — after an initial HTTP handshake (upgrade request), both client and server can send messages to each other at any time over a single persistent connection. This makes it ideal for real-time features like chat, live notifications, collaborative editing, and gaming.

---

**Q3: What does `io.on('connection', socket => {})` do?**

> It registers an event listener on the Socket.IO server for new client connections. Every time a client establishes a WebSocket connection, the callback function is invoked with a `socket` object. This `socket` represents that specific client and is used to:
> - Listen for events from that client (`socket.on(...)`)
> - Send events to that client (`socket.emit(...)`)
> - Join/leave rooms (`socket.join(...)`)
> - Detect disconnection (`socket.on('disconnect', ...)`)

---

**Q4: Why use Socket.IO instead of the native WebSocket API?**

> The native WebSocket API provides only basic message sending/receiving. Socket.IO is a framework built on top of WebSocket that adds:
> 1. **Automatic reconnection** — reconnects seamlessly if the connection drops
> 2. **Transport fallback** — falls back to HTTP long-polling if WebSocket is blocked (corporate firewalls, proxies)
> 3. **Event system** — named events (`emit('chat', data)`) instead of raw string messages
> 4. **Rooms & Namespaces** — built-in grouping of connections
> 5. **Acknowledgements** — callback-based confirmation that a message was received
> 6. **Binary support** — can send ArrayBuffers, Blobs natively
> 7. **Middleware support** — run logic before accepting connections
>
> Trade-off: Socket.IO adds ~40KB to the client bundle and is NOT compatible with raw WebSocket clients — both sides must use Socket.IO.

---

**Q5: What is the `socket` object in Socket.IO?**

> The `socket` object is an instance that represents a single client connection. Key properties:
> - `socket.id` — unique identifier for this connection
> - `socket.handshake` — details about the connection handshake (headers, query params, auth)
> - `socket.rooms` — Set of rooms this socket has joined
> - `socket.data` — arbitrary data you can attach to this socket
>
> Key methods:
> - `socket.emit(event, data)` — send event to THIS client
> - `socket.on(event, callback)` — listen for events from THIS client
> - `socket.join(room)` — add this socket to a room
> - `socket.leave(room)` — remove this socket from a room
> - `socket.disconnect()` — forcefully disconnect this client

---

**Q6: What happens under the hood when a Socket.IO client connects?**

> 1. Client makes an HTTP GET request to `/socket.io/?EIO=4&transport=polling` (Engine.IO handshake)
> 2. Server responds with a session ID and connection parameters
> 3. If WebSocket is available, client sends an HTTP `Upgrade` request
> 4. Server accepts → connection upgrades from HTTP to WebSocket
> 5. If WebSocket fails, the connection stays on HTTP long-polling as fallback
> 6. Once connected, the `connection` event fires on the server with the `socket` object

---

## Phase 2: Serving HTML Client & First Client-Server Connection (Done)

### What was done

We created a client-side HTML page and connected it to the Socket.IO server with full connection lifecycle logging.

**New file structure:**

```
server/
├── public/
│   └── index.html      ← NEW: Client page with Socket.IO
├── src/
│   ├── app.ts          ← UPDATED: Serves static files
│   └── server.ts       ← UPDATED: Connect/disconnect logging
```

**Files changed:**

**`public/index.html`** — Client page with:
- Socket.IO client library loaded from `/socket.io/socket.io.js` (auto-served by Socket.IO server)
- Connection status indicator (green = connected, red = disconnected)
- Live Socket ID display
- Event log showing connect, disconnect, and reconnection attempts

```html
<!-- Socket.IO auto-serves its client library at this path -->
<script src="/socket.io/socket.io.js"></script>

<script>
    const socket = io();  // Connect to the server

    socket.on('connect', () => { /* update UI to "Connected" */ });
    socket.on('disconnect', (reason) => { /* update UI to "Disconnected" */ });
    socket.io.on('reconnect_attempt', (attempt) => { /* log attempt */ });
</script>
```

**`app.ts`** — Added static file serving:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '..', 'public')));
```

**`server.ts`** — Added detailed connection logging:

```ts
io.on('connection', (socket) => {
    console.log(`[+] User connected    | Socket ID: ${socket.id} | Total: ${io.engine.clientsCount}`);

    socket.on('disconnect', (reason) => {
        console.log(`[-] User disconnected | Socket ID: ${socket.id} | Reason: ${reason} | Total: ${io.engine.clientsCount}`);
    });
});
```

---

### How it works

#### Client Loading Flow:

```
Browser visits http://localhost:3000
    │
    ├── 1. GET /              → Express serves index.html (from public/)
    ├── 2. GET /socket.io/socket.io.js  → Socket.IO auto-serves its client JS
    └── 3. Client calls io()  → WebSocket handshake begins
         │
         ├── connect event fires on CLIENT  → UI turns green
         └── connection event fires on SERVER → logs Socket ID
```

#### Key Concept: How `/socket.io/socket.io.js` works

You do NOT need to install a separate client package. When you create `new Server(httpServer)`, Socket.IO automatically:
1. Registers a route at `/socket.io/socket.io.js`
2. Serves its client-side library from that route
3. The client script includes the `io()` function used to connect

#### Key Concept: `__dirname` in ES Modules

In CommonJS (`"type": "commonjs"`), `__dirname` is a global. But in ES Modules (`"type": "module"`), it doesn't exist. We recreate it:

```ts
const __filename = fileURLToPath(import.meta.url);  // file:///path/to/app.ts → /path/to/app.ts
const __dirname = path.dirname(__filename);          // /path/to/app.ts → /path/to/
```

#### Key Concept: `express.static` middleware

```ts
app.use(express.static(path.join(__dirname, '..', 'public')));
```

This tells Express: "For any incoming request, first check if a matching file exists in the `public/` folder. If yes, serve it. If no, pass to the next middleware/route."

- `GET /` → looks for `public/index.html` → found → serves it
- `GET /style.css` → looks for `public/style.css` → not found → passes to next handler

#### Key Concept: Disconnect reasons

The `disconnect` event provides a `reason` string:

| Reason | Meaning |
|--------|---------|
| `transport close` | User closed the tab/browser |
| `ping timeout` | Client stopped responding to heartbeats |
| `transport error` | Network error occurred |
| `server namespace disconnect` | Server called `socket.disconnect()` |
| `client namespace disconnect` | Client called `socket.disconnect()` |

---

### Interview Questions

**Q1: How does the Socket.IO client library get loaded in the browser without installing a separate npm package?**

> When you create a Socket.IO server with `new Server(httpServer)`, it automatically registers an HTTP route at `/socket.io/socket.io.js` that serves the client-side library. This means you just add `<script src="/socket.io/socket.io.js"></script>` to your HTML — no extra npm package needed. However, for production apps with bundlers (Webpack, Vite), you'd install `socket.io-client` as an npm package and import it.

---

**Q2: Why do we need `fileURLToPath` and `import.meta.url` to get `__dirname` in ES Modules?**

> In CommonJS modules, Node.js provides `__dirname` and `__filename` as global variables. But ES Modules (when `"type": "module"` is set in package.json) don't have these globals. Instead, `import.meta.url` gives you the file's URL in `file:///` protocol format. `fileURLToPath()` converts this to a regular filesystem path, and `path.dirname()` extracts the directory — effectively recreating `__dirname`.

---

**Q3: What is the purpose of `express.static()` and how does it interact with other routes?**

> `express.static()` is a built-in Express middleware that serves static files (HTML, CSS, JS, images) from a specified directory. When a request comes in:
> 1. Express checks the static directory for a matching file
> 2. If found → serves the file immediately (does not hit other routes)
> 3. If not found → passes to the next middleware/route via `next()`
>
> Important: `index.html` is special — `express.static` automatically serves it for the root path `/`. So `GET /` returns `public/index.html` without needing an explicit route. If you had both `express.static` and `app.get('/')`, the one registered FIRST wins.

---

**Q4: What is the `io.engine.clientsCount` property?**

> `io.engine` refers to the underlying Engine.IO server (the transport layer that Socket.IO is built on). `clientsCount` returns the current number of connected clients. This is useful for monitoring — tracking how many users are online. Note: this counts all connections across all namespaces.

---

**Q5: What is the difference between `socket.on('disconnect')` on the server vs `socket.on('disconnect')` on the client?**

> Both listen for the disconnect event, but from different perspectives:
> - **Server-side** `socket.on('disconnect', reason)` — fires when a specific client disconnects. The `reason` tells you why (tab closed, network error, etc.). The server can still communicate with OTHER connected clients.
> - **Client-side** `socket.on('disconnect', reason)` — fires when THIS client loses connection to the server. The client can then show a "disconnected" UI and Socket.IO will automatically attempt to reconnect.

---

**Q6: What happens if you open the same page in 3 browser tabs?**

> Each tab creates a completely independent Socket.IO connection with its own unique `socket.id`. The server's `connection` event fires 3 times, creating 3 separate socket objects. Each tab is treated as a separate client. `io.engine.clientsCount` would show `3`. If one tab closes, only that tab's `disconnect` event fires — the other two remain connected.

---

**Q7: What is the `io()` function on the client side, and what options can you pass to it?**

> `io()` is the default export of the Socket.IO client library. When called with no arguments, it connects to the same host that served the page. You can also pass:
> ```js
> const socket = io('http://localhost:3000', {
>     reconnection: true,           // auto-reconnect (default: true)
>     reconnectionAttempts: 5,      // max attempts (default: Infinity)
>     reconnectionDelay: 1000,      // initial delay in ms (default: 1000)
>     timeout: 20000,               // connection timeout (default: 20000)
>     transports: ['websocket'],    // skip polling, use WebSocket only
>     auth: { token: 'abc123' }     // send auth data on connect
> });
> ```

---

## Phase 3: Emitting & Listening to Events (Done)

### What was done

We added the core Socket.IO communication pattern — emitting and listening to custom events between client and server, plus the acknowledgement (callback) pattern.

**Files changed:**

```
server/
├── public/
│   └── index.html      ← UPDATED: Message form, event handling, ping/ack button
├── src/
│   └── server.ts       ← UPDATED: Listens for chat:message & ping:server events
```

**`server.ts`** — Two new event listeners inside `io.on('connection')`:

```ts
// 1. Listen for chat messages from client
socket.on('chat:message', (data) => {
    console.log(`[msg] ${socket.id}: ${data.text}`);

    // Echo the message back to the SAME client
    socket.emit('chat:message', {
        text: data.text,
        sender: socket.id,
        timestamp: Date.now(),
    });
});

// 2. Acknowledgement pattern — server calls the callback
socket.on('ping:server', (data, callback) => {
    console.log(`[ping] from ${socket.id}:`, data);

    callback({
        status: 'ok',
        message: 'pong from server!',
        receivedAt: Date.now(),
    });
});
```

**`index.html`** — Added message form and ping button:

```js
// Client emits event to server
socket.emit('chat:message', { text });

// Client listens for event from server
socket.on('chat:message', (data) => {
    addMessage(data.sender === socket.id ? 'You' : data.sender, data.text);
});

// Client emits with acknowledgement callback
socket.emit('ping:server', { sentAt: Date.now() }, (response) => {
    // This callback is called by the server — NOT a separate event
    console.log(response.message); // "pong from server!"
});
```

---

### How it works

#### The 3 Communication Patterns in Socket.IO:

```
Pattern 1: Client → Server (fire and forget)
┌──────────┐   emit('chat:message', data)   ┌──────────┐
│  Client   │ ─────────────────────────────► │  Server   │
└──────────┘                                  └──────────┘

Pattern 2: Server → Client (fire and forget)
┌──────────┐   emit('chat:message', data)   ┌──────────┐
│  Server   │ ─────────────────────────────► │  Client   │
└──────────┘                                  └──────────┘

Pattern 3: Client → Server with Acknowledgement (request-response style)
┌──────────┐   emit('ping:server', data, callback)   ┌──────────┐
│  Client   │ ──────────────────────────────────────► │  Server   │
│           │ ◄────────────────────────────────────── │           │
└──────────┘   callback({ status: 'ok' })             └──────────┘
```

#### Key Concept: `emit()` and `on()` — The Event System

Socket.IO uses an **event-based** model (like Node.js EventEmitter):

- **`socket.emit(eventName, data)`** — Sends a custom event with data
- **`socket.on(eventName, callback)`** — Listens for that event

You can name events anything you want. Convention: use **namespaced names** like `chat:message`, `user:typing`, `room:join` for clarity.

#### Key Concept: Acknowledgements (Callbacks)

Normal `emit` is fire-and-forget — you don't know if the server received it. With acknowledgements:

```js
// CLIENT: pass a callback as the LAST argument
socket.emit('ping:server', data, (response) => {
    // This runs when the server calls the callback
});

// SERVER: the last parameter is the callback function
socket.on('ping:server', (data, callback) => {
    callback({ status: 'ok' }); // This triggers the client's callback
});
```

This is like a mini request-response inside WebSocket — useful for confirming actions (message saved, room joined, etc.).

#### Key Concept: Why `socket.emit()` not `io.emit()`?

- **`socket.emit(event, data)`** — Sends to THIS specific client only
- **`io.emit(event, data)`** — Sends to ALL connected clients (broadcasting — Phase 4)

Right now we use `socket.emit` so the message only goes back to the sender. In Phase 4, we'll use broadcasting to send it to everyone.

---

### Interview Questions

**Q1: What is the difference between `socket.emit()` and `socket.on()`?**

> `socket.emit(eventName, data)` **sends** an event with data to the other side. `socket.on(eventName, callback)` **listens** for an event from the other side. They work as a pair:
> - Client's `emit` → triggers server's `on`
> - Server's `emit` → triggers client's `on`
>
> Think of it like a walkie-talkie: `emit` = press the button and talk, `on` = listen for incoming.

---

**Q2: What are Socket.IO acknowledgements and when would you use them?**

> Acknowledgements are a callback-based pattern where the emitter passes a function as the last argument, and the receiver calls that function to send a response back. It's like a promise-based request-response within WebSocket.
>
> Use cases:
> - Confirming a message was saved to the database
> - Validating data before joining a room
> - Getting a server-computed result back to the client
>
> ```js
> // Client
> socket.emit('save:message', { text: 'hi' }, (response) => {
>     if (response.saved) showConfirmation();
> });
> // Server
> socket.on('save:message', async (data, callback) => {
>     await db.save(data);
>     callback({ saved: true });
> });
> ```

---

**Q3: Can you emit any event name, or are there reserved event names in Socket.IO?**

> You can use any custom event name, but several names are **reserved** and cannot be used:
> - `connect` / `connection` — fired when a client connects
> - `disconnect` — fired when a client disconnects
> - `error` — fired on errors
> - `disconnecting` — fired BEFORE disconnect (socket still in rooms)
> - `newListener` / `removeListener` — inherited from EventEmitter
>
> Using reserved names for custom events will cause unexpected behavior. Convention: use namespaced names like `chat:message` or `user:join` to avoid collisions.

---

**Q4: What is the difference between `socket.emit()`, `io.emit()`, and `socket.broadcast.emit()`?**

> | Method | Who receives it |
> |--------|----------------|
> | `socket.emit()` | Only the specific client (the socket) |
> | `io.emit()` | ALL connected clients (including sender) |
> | `socket.broadcast.emit()` | ALL clients EXCEPT the sender |
>
> Example: In a chat app, when User A sends a message:
> - `socket.emit()` → only User A sees it (echo/confirmation)
> - `io.emit()` → User A, B, C all see it
> - `socket.broadcast.emit()` → User B, C see it, but NOT User A

---

**Q5: What data types can you send through `socket.emit()`?**

> Socket.IO supports:
> - **Strings, numbers, booleans, null**
> - **Objects and arrays** (automatically serialized to JSON)
> - **Binary data** — `Buffer`, `ArrayBuffer`, `Blob`, `File`
> - **Mixed** — objects containing binary fields are auto-detected
>
> You can send multiple arguments: `socket.emit('event', arg1, arg2, arg3)`
>
> You CANNOT send: functions (except the acknowledgement callback), class instances (they lose their prototype), circular references, or `undefined` (gets dropped).

---

**Q6: How is Socket.IO's event system different from REST APIs?**

> | Feature | REST API | Socket.IO Events |
> |---------|----------|-------------------|
> | Direction | Client → Server only | Bidirectional |
> | Connection | New connection per request | Persistent connection |
> | Pattern | Request-Response only | Fire-and-forget + Ack |
> | Server-initiated | Not possible (need polling/SSE) | Server can emit anytime |
> | Overhead | Full HTTP headers each time | Minimal frame headers |
> | Event naming | HTTP methods (GET, POST) | Any custom name |
>
> REST is better for CRUD operations, caching, and stateless APIs. Socket.IO is better for real-time, event-driven, bidirectional communication.

---

## Phase 4: Broadcasting — Send Messages to All/Other Users (Done)

### What was done

We upgraded from single-client echo to real multi-user communication. Messages now go to ALL connected clients, and join/leave notifications are broadcast to others.

**Files changed:**

```
server/
├── public/
│   └── index.html      ← UPDATED: User count display, join/leave notifications, multi-user messages
├── src/
│   └── server.ts       ← UPDATED: io.emit for chat, socket.broadcast.emit for join/leave
```

**`server.ts`** — Key changes inside `io.on('connection')`:

```ts
// Phase 3 (before): socket.emit → sends only to sender
socket.emit('chat:message', messageData);

// Phase 4 (now): io.emit → sends to ALL connected clients
io.emit('chat:message', messageData);

// Notify others when someone joins (broadcast = everyone EXCEPT sender)
socket.broadcast.emit('user:joined', {
    id: socket.id,
    totalUsers: io.engine.clientsCount,
});

// Notify others when someone leaves
socket.broadcast.emit('user:left', {
    id: socket.id,
    totalUsers: io.engine.clientsCount,
});

// Send user count to the newly connected client only
socket.emit('user:count', { totalUsers: io.engine.clientsCount });
```

**`index.html`** — New event listeners:

```js
// Join/leave notifications
socket.on('user:joined', (data) => {
    addNotification(`${data.id.slice(0, 8)}... joined the chat`);
    userCountEl.textContent = `Online: ${data.totalUsers}`;
});

socket.on('user:left', (data) => {
    addNotification(`${data.id.slice(0, 8)}... left the chat`);
    userCountEl.textContent = `Online: ${data.totalUsers}`;
});
```

---

### How it works

#### The 4 Broadcasting Methods — Complete Map:

```
Method 1: socket.emit(event, data)
┌──────────┐                        ┌──────────┐
│  Server   │ ─────────────────────► │ Client A │  (only Client A)
│           │                        └──────────┘
│           │     ✗ Client B
│           │     ✗ Client C
└──────────┘

Method 2: socket.broadcast.emit(event, data)
┌──────────┐                        ┌──────────┐
│  Server   │     ✗ Client A         │ Client B │ ✓
│  (from A) │ ─────────────────────► │ Client C │ ✓
└──────────┘     (everyone EXCEPT A)  └──────────┘

Method 3: io.emit(event, data)
┌──────────┐                        ┌──────────┐
│  Server   │ ─────────────────────► │ Client A │ ✓
│           │ ─────────────────────► │ Client B │ ✓
│           │ ─────────────────────► │ Client C │ ✓
└──────────┘     (EVERYONE)          └──────────┘

Method 4: io.to(room).emit(event, data)  ← Phase 5
┌──────────┐                        ┌──────────┐
│  Server   │ ─────────────────────► │ Client A │ ✓  (in room "lobby")
│           │ ─────────────────────► │ Client B │ ✓  (in room "lobby")
│           │     ✗ Client C          └──────────┘    (NOT in room)
└──────────┘
```

#### When to use which method:

| Scenario | Method | Why |
|----------|--------|-----|
| Chat message | `io.emit()` | Everyone sees the message (including sender) |
| "User X joined" | `socket.broadcast.emit()` | Others should know, but the joiner already knows they joined |
| "User X left" | `socket.broadcast.emit()` | Notify remaining users |
| Private confirmation | `socket.emit()` | Only tell the sender (e.g., "message saved") |
| Room message | `io.to(room).emit()` | Only members of that room (Phase 5) |

#### Key Concept: Why `broadcast` for join/leave but `io.emit` for messages?

- **Join notification**: The user who joined doesn't need to be told they joined — they already know. So `socket.broadcast.emit` sends it to everyone else.
- **Chat message**: The sender ALSO needs to see their message in the chat UI (as confirmation it was delivered). So `io.emit` sends to everyone including the sender.
- **Alternative pattern**: Some apps use `socket.broadcast.emit` for messages too, and add the message to the sender's UI immediately on the client side (optimistic UI). This feels faster but risks showing a message that the server rejected.

#### Key Concept: Why send `user:count` separately on connect?

When a new client connects:
1. `socket.broadcast.emit('user:joined')` notifies existing clients with the new count
2. But the new client itself missed that event (it was the trigger, not a receiver)
3. So we send `socket.emit('user:count')` to give the new client the current count

This is a common pattern: **broadcast to others + direct message to self** to ensure everyone has the same state.

---

### Interview Questions

**Q1: What is the difference between `io.emit()`, `socket.emit()`, and `socket.broadcast.emit()`?**

> - **`socket.emit(event, data)`** — Sends to ONE specific client (the socket that triggered the event)
> - **`socket.broadcast.emit(event, data)`** — Sends to ALL clients EXCEPT the sender
> - **`io.emit(event, data)`** — Sends to ALL connected clients including the sender
>
> Think of it like a classroom:
> - `socket.emit` = teacher whispers to one student
> - `socket.broadcast.emit` = teacher announces to the class except one student
> - `io.emit` = teacher announces to the entire class

---

**Q2: In a chat app, should you use `io.emit()` or `socket.broadcast.emit()` for sending messages? What are the trade-offs?**

> **Option A: `io.emit()`** — Server sends the message to ALL clients including sender.
> - Pro: Single source of truth — the message displayed is exactly what the server processed
> - Pro: If the server modifies the message (sanitizes, adds timestamp), everyone sees the same version
> - Con: Slight delay for the sender to see their own message (network round-trip)
>
> **Option B: `socket.broadcast.emit()` + optimistic client-side display**
> - Pro: Sender sees their message instantly (no round-trip wait)
> - Pro: Feels faster and more responsive
> - Con: If the server rejects or modifies the message, the sender sees a different version than others
> - Con: More complex — need to handle the case where the server rejects the message
>
> Most production apps use **Option B** with reconciliation (update the optimistic message when server confirms). For learning, **Option A** is simpler and correct.

---

**Q3: Why do we use `socket.broadcast.emit` inside the `disconnect` event instead of `io.emit`?**

> When a client disconnects, the `disconnect` event fires for that socket. At this point:
> - The disconnected client can no longer receive events
> - Using `io.emit` would attempt to send to a socket that's already gone (wasted effort)
> - `socket.broadcast.emit` correctly sends only to the remaining connected clients
>
> Technically, `io.emit` would still work because Socket.IO handles the dead socket gracefully, but `broadcast` is semantically correct and slightly more efficient.

---

**Q4: What happens if you call `io.emit()` outside the `io.on('connection')` callback? Is that valid?**

> Yes, it's completely valid. `io.emit()` is a method on the Socket.IO server instance, not on a specific socket. You can call it anywhere you have access to `io`:
>
> ```ts
> // Example: broadcast from a REST endpoint
> app.post('/api/announcement', (req, res) => {
>     io.emit('announcement', { text: req.body.message });
>     res.json({ sent: true });
> });
>
> // Example: broadcast on a timer
> setInterval(() => {
>     io.emit('server:time', { time: Date.now() });
> }, 1000);
> ```
>
> This is a powerful pattern — it lets REST APIs trigger real-time updates to all connected WebSocket clients.

---

**Q5: How does `socket.broadcast` work internally?**

> `socket.broadcast` returns a special `BroadcastOperator` object that, when `.emit()` is called:
> 1. Iterates over all sockets in the target namespace (default: `/`)
> 2. Skips the socket that initiated the broadcast (the sender)
> 3. Sends the event to every remaining socket
>
> It's essentially equivalent to:
> ```ts
> for (const [id, s] of io.sockets.sockets) {
>     if (id !== socket.id) {
>         s.emit(event, data);
>     }
> }
> ```
> But Socket.IO's implementation is optimized — it doesn't loop in userland; it uses internal adapter methods that are more efficient, especially with Redis adapter for multi-server setups.

---

**Q6: If 1000 users are connected and one sends a message, does the server create 1000 separate packets?**

> With a single Socket.IO server: **yes**, roughly. The server iterates over all connected sockets and sends a WebSocket frame to each. Each frame is a small packet (just the event name + JSON data), so for a chat message this is very efficient.
>
> With **Redis adapter** (multi-server, Phase 9): the server publishes the message once to Redis, and each server instance that has connected clients picks it up and distributes locally. This avoids one server needing to manage all 1000 connections.
>
> For very large scale (100K+ connections), you'd consider:
> - Message batching
> - Binary protocols instead of JSON
> - Dedicated message brokers (Kafka, NATS)
> - Client-side pagination (don't send all history)

---

## Phase 5: Rooms & Namespaces — Group Chats, Channels (Done)

### What was done

We added chat rooms so users can join different channels. Messages are now scoped to rooms — only users in the same room see each other's messages.

**Files changed:**

```
server/
├── public/
│   └── index.html      ← UPDATED: Room selector buttons, room-scoped UI
├── src/
│   └── server.ts       ← UPDATED: Room join/leave, room-scoped messaging, socket.data
```

**`server.ts`** — Key changes:

```ts
const ROOMS = ['general', 'tech', 'random'];

// Auto-join 'general' on connect
socket.join('general');
socket.data.currentRoom = 'general';

// Join a room (with validation + ack)
socket.on('room:join', async (data, callback) => {
    socket.leave(oldRoom);                              // leave old room
    socket.to(oldRoom).emit('user:left', { ... });      // notify old room

    socket.join(newRoom);                               // join new room
    socket.to(newRoom).emit('user:joined', { ... });    // notify new room
    socket.data.currentRoom = newRoom;

    callback({ status: 'ok', room: newRoom, userCount });
});

// Messages now go to the room, not globally
socket.on('chat:message', (data) => {
    io.to(socket.data.currentRoom).emit('chat:message', messageData);
});
```

**`index.html`** — Room selector with active state:

```js
socket.on('room:list', (data) => { /* render room buttons */ });

function joinRoom(room) {
    socket.emit('room:join', { room }, (response) => {
        // update UI, clear messages, highlight active button
    });
}
```

---

### How it works

#### Rooms — The Complete Picture:

```
Socket.IO Server
│
├── Room: "general"
│   ├── Socket A  ← sees messages in #general
│   └── Socket B  ← sees messages in #general
│
├── Room: "tech"
│   └── Socket C  ← sees messages in #tech only
│
└── Room: "random"
    └── Socket D  ← sees messages in #random only

io.to("general").emit("chat:message", data)
→ Only Socket A and B receive it
→ Socket C and D do NOT
```

#### Key Room Methods:

| Method | What it does |
|--------|-------------|
| `socket.join("room")` | Add this socket to a room |
| `socket.leave("room")` | Remove this socket from a room |
| `io.to("room").emit()` | Send to ALL sockets in the room (including sender if in room) |
| `socket.to("room").emit()` | Send to all in room EXCEPT this socket |
| `io.in("room").fetchSockets()` | Get all socket objects in a room |
| `socket.rooms` | Set of all rooms this socket is in (includes its own ID) |

#### Key Concept: Every socket is automatically in a room with its own ID

When a socket connects, Socket.IO automatically joins it to a room named after its `socket.id`. This is why `socket.emit()` works — it's actually sending to the room `socket.id`:

```ts
// These are equivalent:
socket.emit('hello', data);
io.to(socket.id).emit('hello', data);
```

This also means `socket.rooms` always contains at least one entry — its own ID room.

#### Key Concept: `socket.data` — Attaching custom data to a socket

```ts
socket.data.currentRoom = 'general';
socket.data.username = 'Alice';
```

`socket.data` is a plain object where you can store any data associated with this connection. It persists for the lifetime of the socket and is accessible from anywhere you have the socket reference. It also works across servers with the Redis adapter (Phase 9).

#### Key Concept: Rooms vs Namespaces — When to use which?

| Feature | Rooms | Namespaces |
|---------|-------|------------|
| Created | Dynamically at runtime | Defined in code (static) |
| Client connects to | Same connection, server-managed | Separate connection per namespace |
| Use case | Chat rooms, game lobbies, channels | Separate features (chat, notifications, admin) |
| Joining | `socket.join(room)` on server only | Client connects with `io("/namespace")` |
| Multiple at once | A socket can be in MANY rooms | A socket needs separate connection per namespace |
| Example | `#general`, `#tech`, `#random` | `/chat`, `/notifications`, `/admin` |

**Rule of thumb**: Use **rooms** for grouping users dynamically (channels, lobbies). Use **namespaces** for separating concerns architecturally (different features on different endpoints).

---

### Interview Questions

**Q1: What are Socket.IO rooms and how do they work?**

> Rooms are server-side groupings of sockets. A socket can join one or more rooms using `socket.join(roomName)`. Once in a room, the server can send events to all sockets in that room using `io.to(roomName).emit()`.
>
> Key characteristics:
> - Rooms exist only on the server — clients don't know about them directly
> - A socket can be in multiple rooms simultaneously
> - Rooms are created lazily when the first socket joins, and destroyed when the last socket leaves
> - Every socket is automatically in a room named after its own `socket.id`

---

**Q2: What is the difference between Rooms and Namespaces in Socket.IO?**

> **Namespaces** are separate communication channels defined in code (e.g., `/chat`, `/admin`). Each namespace requires a separate client connection and can have its own middleware, events, and rooms. They're used to separate different features of your app.
>
> **Rooms** are dynamic subgroups within a namespace. They're created/destroyed at runtime and managed entirely on the server. A socket can be in multiple rooms within the same namespace.
>
> ```
> Server
> ├── Namespace: /chat           ← architectural separation
> │   ├── Room: "general"        ← dynamic grouping
> │   └── Room: "tech"
> └── Namespace: /notifications
>     └── Room: "alerts"
> ```
>
> Think of namespaces as buildings, and rooms as rooms inside a building.

---

**Q3: Can a socket be in multiple rooms at the same time?**

> Yes. A socket can join any number of rooms simultaneously:
> ```ts
> socket.join('general');
> socket.join('announcements');
> socket.join('team-alpha');
> console.log(socket.rooms); // Set { socket.id, 'general', 'announcements', 'team-alpha' }
> ```
> When you call `io.to('general').emit(...)`, the socket receives it. When you call `io.to('team-alpha').emit(...)`, the same socket also receives it.
>
> In our app, we enforce "one room at a time" by calling `socket.leave(oldRoom)` before `socket.join(newRoom)`, but this is an application-level choice, not a Socket.IO limitation.

---

**Q4: How does `io.to(room).emit()` differ from `socket.to(room).emit()`?**

> - **`io.to(room).emit()`** — Sends to ALL sockets in the room, including the current socket if it's a member
> - **`socket.to(room).emit()`** — Sends to all sockets in the room EXCEPT the current socket (the one calling `.to()`)
>
> Use `io.to()` when everyone should receive it (like a chat message the sender should also see). Use `socket.to()` when the sender should be excluded (like a "user is typing" indicator — the typer doesn't need to be told they're typing).

---

**Q5: What is `socket.data` and why is it useful?**

> `socket.data` is a plain JavaScript object attached to each socket for storing custom per-connection data. It's useful for:
> - Tracking which room a user is in: `socket.data.currentRoom = 'general'`
> - Storing user info: `socket.data.username = 'Alice'`
> - Sharing state across event handlers without closures or external maps
>
> Key advantage: With the Redis adapter (multi-server setup), `socket.data` is synchronized across servers. So `io.in("room").fetchSockets()` on any server returns sockets with their `data` intact — unlike a local `Map` which only exists on one server.

---

**Q6: How would you send a private (direct) message to a specific user?**

> Since every socket auto-joins a room with its own ID, you can send directly to a specific socket:
> ```ts
> // Server-side: send to a specific socket by ID
> io.to(targetSocketId).emit('private:message', {
>     from: socket.id,
>     text: 'Hello, just you!'
> });
> ```
> This works because `targetSocketId` is both the socket's ID and the name of its private room. Only that one socket is in that room, so only they receive the event.

---

**Q7: Rooms are created lazily — what does that mean? How are they cleaned up?**

> Socket.IO doesn't require you to "create" a room before using it. When you call `socket.join('my-room')`, the room is created automatically if it doesn't exist. When the last socket leaves (via `socket.leave()` or disconnect), the room is automatically destroyed — no cleanup code needed.
>
> This means:
> - You don't manage room lifecycle
> - Room names can be anything (user IDs for DMs, UUIDs for game lobbies)
> - There's no limit on the number of rooms
> - Empty rooms consume no memory

---

## Phase 6: User Tracking — Online Users, Nicknames, Typing Indicator (Done)

### What was done

We added a username system, online users sidebar, and real-time typing indicator. The app now feels like a real chat application.

**Files changed:**

```
server/
├── public/
│   └── index.html      ← REWRITTEN: Username screen, online users sidebar, typing indicator
├── src/
│   └── server.ts       ← UPDATED: user:set-name, user:typing, broadcastRoomUsers, usernames everywhere
```

**`server.ts`** — Key additions:

```ts
// Helper: get users in a room with their usernames
async function getRoomUsers(room: string) {
    const sockets = await io.in(room).fetchSockets();
    return sockets.map((s) => ({ id: s.id, username: s.data.username || 'Anonymous' }));
}

// Broadcast updated users list to everyone in a room
async function broadcastRoomUsers(room: string) {
    const users = await getRoomUsers(room);
    io.to(room).emit('room:users', { room, users });
}

// Set username (gatekeeper — must set before entering chat)
socket.on('user:set-name', async (data, callback) => {
    socket.data.username = data.username;
    socket.join('general');
    // ... send rooms, notify others, send users list
    callback({ status: 'ok', username });
});

// Typing indicator — broadcast to room except sender
socket.on('user:typing', (data) => {
    socket.to(socket.data.currentRoom).emit('user:typing', {
        id: socket.id,
        username: socket.data.username,
        isTyping: data.isTyping,
    });
});
```

**`index.html`** — Three major UI additions:

1. **Username entry screen** — shown first, hides when username is set
2. **Online users sidebar** — shows all users in current room, highlights you
3. **Typing indicator** — shows "Alice is typing...", "Alice and Bob are typing...", auto-clears after 2s

```js
// Client: emit typing on input, auto-stop after 2s
messageInput.addEventListener('input', () => {
    socket.emit('user:typing', { isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('user:typing', { isTyping: false });
    }, 2000);
});

// Client: track who's typing
socket.on('user:typing', (data) => {
    if (data.isTyping) typingUsers.set(data.id, data.username);
    else typingUsers.delete(data.id);
    updateTypingIndicator();
});
```

---

### How it works

#### App Flow — Now with Authentication:

```
1. Browser loads page
   └── Username screen shown, chat area hidden

2. User types name and clicks "Join Chat"
   └── socket.emit('user:set-name', { username }, callback)
       └── Server validates (2-20 chars)
       └── Server stores: socket.data.username = username
       └── Server joins socket to 'general'
       └── Server broadcasts updated users list to room
       └── callback({ status: 'ok' }) → client shows chat UI

3. User types a message
   └── 'input' event on textbox → emit('user:typing', { isTyping: true })
   └── Other users in room see "Alice is typing..."
   └── After 2s of no input → emit('user:typing', { isTyping: false })

4. Messages and notifications show usernames instead of socket IDs
```

#### Key Concept: Debouncing the Typing Indicator

Without debouncing, every keystroke would emit a `user:typing` event (potentially 10+ per second). Instead:

```js
messageInput.addEventListener('input', () => {
    socket.emit('user:typing', { isTyping: true });  // Emit on first keystroke

    clearTimeout(typingTimeout);                      // Reset the timer
    typingTimeout = setTimeout(() => {
        socket.emit('user:typing', { isTyping: false }); // Stop after 2s idle
    }, 2000);
});
```

This pattern is called **debouncing** — it limits how often the "stop typing" event fires. The "start typing" event fires on every keystroke (cheap), but the "stop" only fires after 2 seconds of silence.

#### Key Concept: `fetchSockets()` — Getting Socket Objects from a Room

```ts
const sockets = await io.in(room).fetchSockets();
// Returns an array of RemoteSocket objects with:
// - s.id          → socket ID
// - s.data        → the socket.data object
// - s.rooms       → Set of rooms
// - s.emit()      → send event to this socket
```

This is the primary way to query who's in a room and what data they have. It's `async` because in a multi-server setup (Redis adapter), it needs to query across servers.

#### Key Concept: Broadcasting Users List on Every Change

Instead of each client tracking joins/leaves independently (error-prone), we broadcast the FULL users list from the server whenever it changes:

```ts
// Called on: join, leave, disconnect, set-name
async function broadcastRoomUsers(room: string) {
    const users = await getRoomUsers(room);
    io.to(room).emit('room:users', { room, users });
}
```

This is the **full-state broadcast** pattern — simpler and more reliable than incremental updates. The client just replaces its entire users list each time.

#### Key Concept: Gating Actions Behind Username

Before Phase 6, the socket could send messages immediately. Now, the flow is:
1. Socket connects → only `user:set-name` works
2. After setting username → server joins the socket to a room
3. Only then can the user send messages, switch rooms, etc.

This is a simple form of **connection authentication** — the server controls what actions are available based on socket state.

---

### Interview Questions

**Q1: How would you implement a "user is typing..." indicator in Socket.IO?**

> The implementation involves three parts:
>
> **Client side:**
> - Listen for `input` events on the message textbox
> - Emit `user:typing` with `isTyping: true` on each keystroke
> - Use a debounce timer (e.g., 2 seconds) to emit `isTyping: false` after the user stops typing
> - When a message is sent, immediately emit `isTyping: false`
>
> **Server side:**
> - Listen for `user:typing` events
> - Broadcast to the sender's room using `socket.to(room).emit()` (excludes sender — you don't need to tell yourself you're typing)
>
> **Receiving clients:**
> - Maintain a Map/Set of currently typing users
> - Add/remove users based on `isTyping` flag
> - Display: "Alice is typing...", "Alice and Bob are typing...", "3 people are typing..."
> - Clean up when a user disconnects or sends a message

---

**Q2: What is debouncing and why is it important for typing indicators?**

> Debouncing is a technique that delays execution of a function until after a period of inactivity. For typing indicators:
>
> - Without debouncing: every keystroke sends TWO events (start + stop), flooding the server with potentially hundreds of events per minute
> - With debouncing: "start typing" fires on the first keystroke, "stop typing" fires only once after 2 seconds of silence
>
> ```js
> // Debounced: resets timer on each keystroke
> clearTimeout(timer);
> timer = setTimeout(() => emit('stop'), 2000);
> ```
>
> This reduces network traffic from O(keystrokes) to O(typing-sessions), which is especially important with many users.

---

**Q3: What is `socket.data` and how does it differ from using a separate `Map` to store user data?**

> `socket.data` is a built-in property on each Socket.IO socket for storing custom per-connection data.
>
> **`socket.data` advantages:**
> - Automatically cleaned up when the socket disconnects (no memory leaks)
> - Works with `fetchSockets()` — you can read `socket.data` from remote sockets
> - Synchronized across servers with the Redis adapter
> - No need to manage a separate data structure
>
> **Separate `Map<socketId, userData>` disadvantages:**
> - Must manually clean up on disconnect (or risk memory leaks)
> - Only accessible on the server that owns the Map
> - Doesn't work across servers in a multi-server setup
> - Must be kept in sync with socket lifecycle
>
> Use `socket.data` for per-connection state. Use a Map/database for shared state that outlives connections.

---

**Q4: Why use `fetchSockets()` to get the users list instead of maintaining a local array?**

> **`fetchSockets()` approach (what we use):**
> - Always accurate — queries the actual state
> - Works across multiple servers (Redis adapter)
> - No sync bugs — can't get out of sync with reality
> - Slightly slower (async, queries adapter)
>
> **Local array approach:**
> - Faster (synchronous, in-memory)
> - Must manually add on join, remove on leave AND disconnect
> - Can get out of sync if you miss an event
> - Only works on a single server
>
> For learning and small-to-medium scale, `fetchSockets()` is the right choice. For very high-frequency queries (e.g., updating users list every second with 10K users), a local cache with invalidation might be needed.

---

**Q5: What is the "full-state broadcast" pattern and when should you use it?**

> Instead of sending incremental updates ("user X joined", "user Y left") and having each client maintain its own state, the server broadcasts the COMPLETE state every time something changes:
>
> ```ts
> // Full-state: server sends the entire list
> io.to(room).emit('room:users', { users: [allUsers] });
>
> // vs Incremental: server sends individual changes
> socket.to(room).emit('user:joined', { user });
> socket.to(room).emit('user:left', { user });
> ```
>
> **Use full-state when:** state is small (users list), changes are infrequent, correctness matters more than bandwidth.
>
> **Use incremental when:** state is large (chat history), changes are frequent, bandwidth is a concern.
>
> We use BOTH in our app: full-state for users list + incremental notifications for the chat messages (join/leave shown as notifications).

---

**Q6: How would you handle username uniqueness in a production app?**

> Our current app doesn't enforce unique usernames. In production:
>
> 1. **Server-side Map:** Maintain a `Set` of taken usernames. Check before accepting.
>    ```ts
>    const takenNames = new Set<string>();
>    socket.on('user:set-name', (data, cb) => {
>        if (takenNames.has(data.username)) return cb({ status: 'error', message: 'Taken' });
>        takenNames.add(data.username);
>        socket.data.username = data.username;
>    });
>    ```
> 2. **Clean up on disconnect:** `takenNames.delete(socket.data.username)`
> 3. **Multi-server:** Use Redis to store taken names across servers
> 4. **Better approach:** Use a database-backed auth system (JWT, session) and look up the username from the authenticated user

---

## Phase 7: Disconnect & Error Handling (Done)

### What was done

We hardened the app with server-side middleware, connection state recovery, rate limiting, input validation, and proper error handling on both client and server.

**Files changed:**

```
server/
├── public/
│   └── index.html      ← UPDATED: Reconnection config, recovery handler, error events
├── src/
│   └── server.ts       ← UPDATED: Server config, middleware, recovery, validation, disconnecting event
```

**`server.ts`** — Key additions:

```ts
// 1. Server configuration — heartbeat + connection state recovery
const io = new Server(server, {
    pingInterval: 25000,                    // Ping client every 25s
    pingTimeout: 20000,                     // Disconnect if no pong in 20s
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,  // Recover within 2 min
        skipMiddlewares: true,                      // Skip auth on recovery
    },
});

// 2. Middleware — logging + rate limiting
io.use((socket, next) => { /* log connection attempts */ next(); });
io.use((socket, next) => { /* rate limit: 10 connections/min/IP */ });

// 3. Connection recovery — skip re-authentication
if (socket.recovered) {
    socket.emit('connection:recovered', { username, room });
    return; // Skip normal setup
}

// 4. Input validation on chat messages
const text = data.text.trim().slice(0, 500); // Limit to 500 chars

// 5. Auth guard — require username before messaging
if (!socket.data.username) {
    socket.emit('error:auth', { message: 'Must set username first' });
    return;
}

// 6. 'disconnecting' event — fires BEFORE leaving rooms
socket.on('disconnecting', (reason) => {
    console.log(`Rooms still available: ${[...socket.rooms]}`);
});

// 7. Engine-level error handler
io.engine.on('connection_error', (err) => { /* log transport errors */ });
```

**`index.html`** — Client improvements:

```js
// Reconnection config
const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,        // Doubles each attempt
    reconnectionDelayMax: 5000,     // Caps at 5s
    timeout: 20000,
});

// Handle recovered connection — restore UI without re-entering username
socket.on('connection:recovered', (data) => {
    myUsername = data.username;
    currentRoom = data.room;
    // Restore chat UI...
});

// Handle connection errors
socket.on('connect_error', (err) => { /* show error */ });
socket.io.on('reconnect_failed', () => { /* all attempts exhausted */ });
```

---

### How it works

#### The Heartbeat System (ping/pong):

```
Server                          Client
  │                               │
  ├── ping ───────────────────►   │  (every 25 seconds)
  │                               ├── pong ──────────────►  (client auto-responds)
  │   ◄─── within 20s? ──────    │
  │   YES → connection alive      │
  │   NO  → disconnect (timeout)  │
```

Socket.IO uses Engine.IO's heartbeat mechanism to detect dead connections:
- **`pingInterval: 25000`** — Server sends a ping every 25 seconds
- **`pingTimeout: 20000`** — If no pong arrives within 20 seconds, the connection is considered dead
- Total detection time: worst case ~45 seconds to detect a dead connection

#### Connection State Recovery:

```
1. Client connects → gets session ID + state stored on server
2. Client disconnects (network drop, tab sleep)
3. Client reconnects within 2 minutes
4. Server recognizes the session → restores rooms, socket.data
5. socket.recovered = true → skip re-authentication
6. Missed events are replayed to the client

If > 2 minutes: full reconnection required (new session)
```

This is built into Socket.IO v4.6+ — no Redis needed for single-server setups.

#### Middleware Chain:

```
Client connects
  │
  ▼
Middleware 1: Logging ──► next()
  │
  ▼
Middleware 2: Rate limit ──► next() or next(new Error(...))
  │
  ▼
io.on('connection') fires ← only if ALL middleware called next()
```

- Middleware runs BEFORE the `connection` event
- Call `next()` to proceed, `next(new Error('msg'))` to reject
- The error message is sent to the client via `connect_error` event
- Middleware runs in order — first registered, first executed

#### `disconnect` vs `disconnecting`:

| Event | When | `socket.rooms` | Use case |
|-------|------|----------------|----------|
| `disconnecting` | Before leaving rooms | Still available | Notify rooms, save state |
| `disconnect` | After leaving rooms | Empty | Clean up, log |

`disconnecting` is useful when you need to know which rooms the user was in (e.g., to broadcast "user left" to each room). By the time `disconnect` fires, `socket.rooms` is already empty.

#### Input Validation — Defense in Depth:

```ts
// 1. Guard: require authentication
if (!socket.data.username) return;

// 2. Type check: ensure data is valid
if (typeof data.text !== 'string') return;

// 3. Sanitize: trim and limit length
const text = data.text.trim().slice(0, 500);

// 4. Empty check: don't broadcast empty messages
if (text.length === 0) return;
```

Never trust client data — even in WebSocket. A malicious client can send anything.

---

### Interview Questions

**Q1: How does Socket.IO detect if a client has disconnected ungracefully (e.g., network cable pulled)?**

> Socket.IO uses a **heartbeat mechanism** via Engine.IO:
> 1. The server sends a `ping` packet at regular intervals (`pingInterval`, default 25s)
> 2. The client must respond with a `pong` within `pingTimeout` (default 20s)
> 3. If no pong arrives, the server considers the client dead and fires `disconnect` with reason `"ping timeout"`
>
> This means ungraceful disconnects are detected within `pingInterval + pingTimeout` (worst case ~45s with defaults). You can tune these values — shorter intervals detect faster but increase network overhead.

---

**Q2: What is Socket.IO Connection State Recovery and how does it work?**

> Connection State Recovery (added in Socket.IO v4.6) allows a client to seamlessly reconnect after a brief disconnection without losing state:
>
> 1. Server stores session state (rooms, `socket.data`) with a session ID
> 2. When client reconnects, it sends its session ID
> 3. If within `maxDisconnectionDuration`, server restores: rooms, `socket.data`, and replays any missed events
> 4. `socket.recovered` is `true` on the server
>
> Limitations:
> - Only works with a single server (or with a compatible adapter like Redis)
> - Events emitted during disconnection are buffered — large buffers = memory pressure
> - `skipMiddlewares: true` bypasses auth on recovery (security trade-off)

---

**Q3: What is Socket.IO middleware and how does it differ from Express middleware?**

> Socket.IO middleware runs on every new **WebSocket connection** attempt (not HTTP requests):
>
> ```ts
> io.use((socket, next) => {
>     // socket.handshake contains headers, query, auth data
>     if (isValid(socket.handshake.auth.token)) next();
>     else next(new Error('Unauthorized'));
> });
> ```
>
> Key differences from Express middleware:
> - Express: runs on every HTTP request. Socket.IO: runs once per connection attempt
> - Express: `(req, res, next)`. Socket.IO: `(socket, next)`
> - Express: can modify response. Socket.IO: can only accept/reject connection
> - Rejection sends error to client via `connect_error` event
> - Middleware order matters — they run sequentially

---

**Q4: What is the difference between `disconnect` and `disconnecting` events?**

> - **`disconnecting`**: fires BEFORE the socket leaves its rooms. `socket.rooms` still contains all rooms. Use this to notify room members or save per-room state.
> - **`disconnect`**: fires AFTER the socket has left all rooms. `socket.rooms` is empty. Use this for final cleanup and logging.
>
> ```ts
> socket.on('disconnecting', () => {
>     for (const room of socket.rooms) {
>         if (room !== socket.id) { // Skip the auto-joined room
>             socket.to(room).emit('user:left', { id: socket.id });
>         }
>     }
> });
> ```
>
> This is critical for apps where a socket is in multiple rooms — `disconnect` can't tell you which rooms they were in.

---

**Q5: How would you implement rate limiting for Socket.IO connections?**

> Track connection timestamps per IP and reject if too many within a time window:
>
> ```ts
> const timestamps = new Map<string, number[]>();
>
> io.use((socket, next) => {
>     const ip = socket.handshake.address;
>     const now = Date.now();
>     const recent = (timestamps.get(ip) || []).filter(t => now - t < 60000);
>     recent.push(now);
>     timestamps.set(ip, recent);
>
>     if (recent.length > 10) {
>         next(new Error('Too many connections'));
>     } else {
>         next();
>     }
> });
> ```
>
> For production: use Redis to share rate limit state across servers, consider IP spoofing behind proxies (use `X-Forwarded-For`), and implement per-event rate limiting too (not just connections).

---

**Q6: What are all the possible `disconnect` reasons in Socket.IO?**

> **Server-initiated:**
> | Reason | Cause |
> |--------|-------|
> | `server namespace disconnect` | Server called `socket.disconnect()` |
> | `server shutting down` | Server is closing |
>
> **Client-initiated:**
> | Reason | Cause |
> |--------|-------|
> | `client namespace disconnect` | Client called `socket.disconnect()` |
> | `ping timeout` | Client stopped responding to heartbeats |
> | `transport close` | Client closed the connection (tab close, navigation) |
> | `transport error` | Connection encountered an error |
>
> Only `client namespace disconnect` and `server namespace disconnect` will NOT trigger automatic reconnection. All other reasons trigger the reconnection mechanism.

---

**Q7: Why should you validate WebSocket data the same way you validate REST API data?**

> A WebSocket connection is just a persistent TCP connection — anyone can send arbitrary data through it. A malicious client can:
> - Send oversized payloads (DoS via memory exhaustion)
> - Send wrong data types (crash if you assume structure)
> - Send messages without authenticating first
> - Inject scripts in message text (XSS if rendered as HTML)
>
> Always validate:
> 1. **Authentication** — is the socket authorized to perform this action?
> 2. **Type checking** — is `data.text` actually a string?
> 3. **Length limits** — cap message length, prevent abuse
> 4. **Sanitization** — trim whitespace, escape HTML if rendering
> 5. **Rate limiting** — prevent spam (per-event, not just per-connection)

---

## Phase 8: CORS, Middleware & Authentication for WebSockets (Next)

**What we'll do:**
1. Configure CORS for Socket.IO (allow specific origins)
2. Implement JWT-based authentication via Socket.IO middleware
3. Protect events — only authenticated sockets can send messages
4. Add auth token passing from client
5. Understand the security model of WebSocket connections
