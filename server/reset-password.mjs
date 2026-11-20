// Admin CLI: reset (or create) a user's password directly in the database.
// Usage:
//   node server/reset-password.mjs <username> <newPassword>
//   node server/reset-password.mjs <username> --generate          (prints a random one)
//   node server/reset-password.mjs <username> --generate --create (recreate missing account)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.join(__dirname, 'data', 'users.json');

const args = process.argv.slice(2);
const createIfMissing = args.includes('--create');
const generate = args.includes('--generate');
const positional = args.filter((a) => !a.startsWith('--'));
const [username, passwordArg] = positional;
if (!username || (!passwordArg && !generate)) {
  console.error('Usage: node server/reset-password.mjs <username> <newPassword|--generate> [--create]');
  process.exit(1);
}

const cleanUsername = username.trim().toLowerCase();
const user = db.sqlite.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);

const newPassword = generate
  ? crypto.randomBytes(9).toString('base64url') // ~12 chars, URL-safe
  : passwordArg;

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(newPassword, 10);

let userId = user?.id;
if (!user && createIfMissing) {
  const insert = db.sqlite.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  const res = insert.run(cleanUsername, passwordHash);
  userId = Number(res.lastInsertRowid);
  console.log(`+ Created missing user "${cleanUsername}" (id ${res.lastInsertRowid}).`);
} else if (!user) {
  const allUsers = db.sqlite.prepare('SELECT username FROM users').all();
  console.error(
    `User "${cleanUsername}" not found. Existing users: ${
      allUsers.map((u) => u.username).join(', ') || '(none)'
    }`
  );
  console.error('Add --create to recreate the account.');
  process.exit(1);
} else {
  db.sqlite.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, cleanUsername);
  console.log(`✔ Password updated for "${cleanUsername}".`);
}

// Also update legacy users.json if present
if (fs.existsSync(usersFile)) {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8').replace(/^\uFEFF/, '');
    const users = JSON.parse(raw);
    if (Array.isArray(users)) {
      const u = users.find((x) => x.username === cleanUsername);
      if (u) {
        u.password_hash = passwordHash;
      } else if (createIfMissing) {
        users.push({
          id: userId,
          username: cleanUsername,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
        });
      }
      const tmpFile = `${usersFile}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), 'utf8');
      fs.renameSync(tmpFile, usersFile);
    }
  } catch {}
}

if (generate) {
  console.log(`  New password: ${newPassword}`);
}
console.log('  (Old passwords cannot be recovered — only reset.)');
