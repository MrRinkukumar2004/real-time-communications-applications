import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const app = express();

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));