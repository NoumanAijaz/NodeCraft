import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const projectsDir = path.join(__dirname, 'projects');
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'nodecraft.db');
const usersFile = path.join(dataDir, 'users.json');
const projectsFile = path.join(dataDir, 'projects.json');

// Initialize SQLite database instance
const sqlite = new DatabaseSync(dbPath);

// Enable WAL (Write-Ahead Logging) mode and foreign keys for high write concurrency & data integrity
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA synchronous = NORMAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

// Create tables and indexes
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
`);

// Auto-migrate from existing JSON files on first run if database is empty
function autoMigrateFromJson() {
  try {
    const userCountRow = sqlite.prepare('SELECT count(*) AS count FROM users').get();
    const userCount = Number(userCountRow?.count || 0);

    if (userCount === 0 && fs.existsSync(usersFile)) {
      const raw = fs.readFileSync(usersFile, 'utf8').replace(/^\uFEFF/, '');
      const usersData = JSON.parse(raw);
      if (Array.isArray(usersData) && usersData.length > 0) {
        const insertUser = sqlite.prepare(
          'INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
        );
        for (const u of usersData) {
          insertUser.run(
            u.id,
            u.username,
            u.password_hash,
            u.created_at || new Date().toISOString()
          );
        }
        console.log(`[Database Migration] Migrated ${usersData.length} user(s) from users.json to SQLite.`);
      }
    }

    const projCountRow = sqlite.prepare('SELECT count(*) AS count FROM projects').get();
    const projCount = Number(projCountRow?.count || 0);

    if (projCount === 0 && fs.existsSync(projectsFile)) {
      const raw = fs.readFileSync(projectsFile, 'utf8').replace(/^\uFEFF/, '');
      const projectsData = JSON.parse(raw);
      if (Array.isArray(projectsData) && projectsData.length > 0) {
        const insertProject = sqlite.prepare(
          'INSERT OR IGNORE INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        );
        for (const p of projectsData) {
          insertProject.run(
            p.id,
            p.user_id,
            p.name,
            p.created_at || new Date().toISOString(),
            p.updated_at || new Date().toISOString()
          );
        }
        console.log(`[Database Migration] Migrated ${projectsData.length} project(s) from projects.json to SQLite.`);
      }
    }
  } catch (err) {
    console.error('[Database Migration Warning] Error migrating JSON to SQLite:', err.message);
  }
}

autoMigrateFromJson();

/**
 * SQLite database wrapper compatible with the SQLite callback pattern.
 */
const db = {
  sqlite,

  run(sql, params = [], callback) {
    queueMicrotask(() => {
      try {
        const stmt = sqlite.prepare(sql);
        const result = stmt.run(...params);
        const context = {
          lastID: Number(result.lastInsertRowid),
          changes: Number(result.changes),
        };
        if (callback) callback.call(context, null);
      } catch (err) {
        if (callback) callback(err);
        else throw err;
      }
    });
  },

  get(sql, params = [], callback) {
    queueMicrotask(() => {
      try {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...params);
        if (callback) callback(null, row || null);
      } catch (err) {
        if (callback) callback(err);
        else throw err;
      }
    });
  },

  all(sql, params = [], callback) {
    queueMicrotask(() => {
      try {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...params);
        if (callback) callback(null, rows || []);
      } catch (err) {
        if (callback) callback(err);
        else throw err;
      }
    });
  },

  serialize(fn) {
    if (fn) fn();
  },

  close() {
    try {
      sqlite.close();
    } catch {
      // Ignore if already closed
    }
  },
};

export default db;
