// Admin CLI: reset (or create) a user's password directly in the JSON database.
// Usage:
//   node server/reset-password.mjs <username> <newPassword>
//   node server/reset-password.mjs <username> --generate          (prints a random one)
//   node server/reset-password.mjs <username> --generate --create (recreate missing account)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.join(__dirname, 'data', 'users.json');

const args = process.argv.slice(2);
const createIfMissing = args.includes('--create');
const generate = args.includes('--generate');
const positional = args.filter(a => !a.startsWith('--'));
const [username, passwordArg] = positional;
if (!username || (!passwordArg && !generate)) {
  console.error('Usage: node server/reset-password.mjs <username> <newPassword|--generate> [--create]');
  process.exit(1);
}

if (!fs.existsSync(usersFile)) {
  console.error(`Database not found at ${usersFile}`);
  process.exit(1);
}

// Strip any UTF-8 BOM so PowerShell-written files still parse
let raw = fs.readFileSync(usersFile, 'utf8').replace(/^\uFEFF/, '');
let users;
try {
  users = JSON.parse(raw);
  if (!Array.isArray(users)) throw new Error('not an array');
} catch (e) {
  console.error('Failed to parse users.json:', e.message);
  process.exit(1);
}

const cleanUsername = username.trim().toLowerCase();
let user = users.find(u => u.username === cleanUsername);

const newPassword = generate
  ? crypto.randomBytes(9).toString('base64url') // ~12 chars, URL-safe
  : passwordArg;

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

if (!user && createIfMissing) {
  const nextId = users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;
  user = {
    id: nextId,
    username: cleanUsername,
    password_hash: '',
    created_at: new Date().toISOString(),
  };
  users.push(user);
  console.log(`+ Created missing user "${cleanUsername}" (id ${nextId}).`);
} else if (!user) {
  console.error(`User "${cleanUsername}" not found. Existing users: ${users.map(u => u.username).join(', ') || '(none)'}`);
  console.error('Add --create to recreate the account.');
  process.exit(1);
}

user.password_hash = await bcrypt.hash(newPassword, 10);

// Atomic write WITHOUT BOM (plain utf8)
const tmpFile = `${usersFile}.tmp`;
fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), 'utf8');
fs.renameSync(tmpFile, usersFile);

console.log(`✔ Password updated for "${cleanUsername}".`);
if (generate) {
  console.log(`  New password: ${newPassword}`);
}
console.log('  (Old passwords cannot be recovered — only reset.)');