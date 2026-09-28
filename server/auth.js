import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import db, { projectsDir } from './db.js';

const router = express.Router();
export const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const fallback = 'nodecraft-secret-jwt-key-change-in-production';
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'FATAL: JWT_SECRET is not set in production — refusing to start with insecure fallback.'
    );
    process.exit(1);
  } else {
    console.warn(
      '⚠️  JWT_SECRET not set — using insecure development fallback. Set JWT_SECRET env var for production.'
    );
  }
  return fallback;
})();

// Pre-computed bcrypt hash. When the username does not exist we still run a
// bcrypt.compare against this hash so the response takes the same time as a
// real password check — otherwise login latency leaks which usernames exist.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('nodecraft-timing-equalizer', 10);

// Auth middleware to verify JWT
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const match = typeof authHeader === 'string' && authHeader.match(/^Bearer (.+)$/);
  const token = match && match[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) {
      // 401 (not 403): the client is unauthenticated, not merely unauthorized.
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // Reject structurally valid tokens that lack our payload shape (e.g. a
    // token minted against a different secret/service reusing this key).
    if (!user || typeof user.userId !== 'number' || typeof user.username !== 'string') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // bcrypt truncates input at 72 bytes — cap length so users don't get
  // less security than they believe.
  if (password.length > 128) {
    return res.status(400).json({ error: 'Password must be at most 128 characters long' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
      [cleanUsername, passwordHash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username is already taken' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const userId = this.lastID;

        // Ensure user projects folder exists
        const userFolder = path.join(projectsDir, cleanUsername);
        if (!fs.existsSync(userFolder)) {
          fs.mkdirSync(userFolder, { recursive: true });
        }

        const token = jwt.sign(
          { userId, username: cleanUsername },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.status(201).json({
          message: 'User registered successfully',
          token,
          user: { id: userId, username: cleanUsername }
        });
      }
    );
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase();

  // Registration caps passwords at 128 chars (bcrypt only hashes the first 72
  // bytes), so anything longer can never match a stored hash — reject early.
  if (password.length > 128) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [cleanUsername],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        // Burn the same bcrypt CPU time as a real password check so response
        // timing doesn't reveal whether the username exists.
        try {
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        } catch {
          /* the comparison result is irrelevant here */
        }
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      let validPassword = false;
      try {
        validPassword = await bcrypt.compare(password, user.password_hash);
      } catch {
        return res.status(500).json({ error: 'Authentication failed' });
      }
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Ensure user projects folder exists
      const userFolder = path.join(projectsDir, cleanUsername);
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }

      const token = jwt.sign(
        { userId: user.id, username: cleanUsername },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, username: cleanUsername }
      });
    }
  );
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  db.get(
    `SELECT id, username, created_at FROM users WHERE id = ?`,
    [req.user.userId],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user });
    }
  );
});

export default router;
