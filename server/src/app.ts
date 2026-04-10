import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerUser, loginUser } from './auth.js';

export const app = express();

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse JSON request bodies
app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

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