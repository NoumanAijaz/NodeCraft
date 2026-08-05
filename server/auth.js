import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import db, { projectsDir } from './db.js';

const router = express.Router();
export const JWT_SECRET = process.env.JWT_SECRET || 'nodecraft-secret-jwt-key-change-in-production';

// Auth middleware to verify JWT
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

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

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
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
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase();

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [cleanUsername],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
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
