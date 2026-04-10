import jwt from 'jsonwebtoken';

// In production, use environment variables for secrets
const JWT_SECRET = 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '1h';

export interface UserPayload {
    username: string;
    iat?: number;
    exp?: number;
}

// Simple in-memory user store (use a database in production)
const users = new Map<string, string>(); // username → password

export function registerUser(username: string, password: string): { success: boolean; message: string } {
    if (users.has(username)) {
        return { success: false, message: 'Username already taken' };
    }
    if (username.length < 2 || username.length > 20) {
        return { success: false, message: 'Username must be 2-20 characters' };
    }
    if (password.length < 4) {
        return { success: false, message: 'Password must be at least 4 characters' };
    }

    // In production: hash the password with bcrypt
    users.set(username, password);
    return { success: true, message: 'Registered successfully' };
}

export function loginUser(username: string, password: string): { success: boolean; token?: string; message: string } {
    const storedPassword = users.get(username);

    if (!storedPassword || storedPassword !== password) {
        return { success: false, message: 'Invalid username or password' };
    }

    const token = jwt.sign({ username } as UserPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    return { success: true, token, message: 'Login successful' };
}

export function verifyToken(token: string): { valid: boolean; payload?: UserPayload; message: string } {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
        return { valid: true, payload, message: 'Token valid' };
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return { valid: false, message: 'Token expired' };
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return { valid: false, message: 'Invalid token' };
        }
        return { valid: false, message: 'Token verification failed' };
    }
}
