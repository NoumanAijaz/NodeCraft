import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

const usersFile = path.join(dataDir, 'users.json');
const projectsFile = path.join(dataDir, 'projects.json');

// Memory cache loaded on startup
let users = [];
let projects = [];
let nextUserId = 1;

// Tolerate a UTF-8 BOM (e.g. from PowerShell Set-Content) instead of silently
// discarding the whole database via the catch below.
function readJsonFile(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function backupCorruptFile(file) {
  try {
    const backup = `${file}.corrupt-${Date.now()}.bak`;
    fs.renameSync(file, backup);
    console.error(`Backed up corrupted file to ${backup}`);
  } catch (backupErr) {
    console.error(`Could not back up corrupted ${file}:`, backupErr.message);
  }
}

try {
  const parsed = readJsonFile(usersFile);
  if (Array.isArray(parsed)) {
    users = parsed;
    nextUserId = users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;
  }
} catch {
  console.error('WARNING: users.json is corrupted — starting with an empty user list.');
  backupCorruptFile(usersFile);
  users = [];
}

try {
  const parsed = readJsonFile(projectsFile);
  if (Array.isArray(parsed)) projects = parsed;
} catch {
  console.error('WARNING: projects.json is corrupted — starting with an empty project list.');
  backupCorruptFile(projectsFile);
  projects = [];
}

function saveUsers() {
  const tmpFile = `${usersFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmpFile, usersFile);
}

function saveProjects() {
  const tmpFile = `${projectsFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(projects, null, 2), 'utf8');
  fs.renameSync(tmpFile, projectsFile);
}

// Pure JS Database interface compatible with SQLite callback pattern
const db = {
  run(sql, params = [], callback) {
    setTimeout(() => {
      try {
        if (sql.includes('INSERT INTO users')) {
          const [username, password_hash] = params;
          const exists = users.some(u => u.username === username);
          if (exists) {
            const err = new Error('UNIQUE constraint failed: users.username');
            if (callback) return callback(err);
            throw err;
          }
          // Recompute from current data so an external edit (e.g. admin CLI)
          // can't cause a duplicate id with the cached counter.
          nextUserId = users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;
          const newUser = {
            id: nextUserId++,
            username,
            password_hash,
            created_at: new Date().toISOString()
          };
          users.push(newUser);
          saveUsers();
          const context = { lastID: newUser.id, changes: 1 };
          if (callback) callback.call(context, null);
        } else if (sql.includes('INSERT INTO projects')) {
          const [id, user_id, name, created_at, updated_at] = params;
          const exists = projects.some(p => p.id === id);
          if (exists) {
            const err = new Error('UNIQUE constraint failed: projects.id');
            if (callback) return callback(err);
            throw err;
          }
          const newProject = { id, user_id, name, created_at, updated_at };
          projects.push(newProject);
          saveProjects();
          const context = { lastID: id, changes: 1 };
          if (callback) callback.call(context, null);
        } else if (sql.includes('UPDATE projects SET name')) {
          // Handles both `SET name = ?, updated_at = ?` and `SET name = ?` forms (second is redundant but kept for compat)
          const [name, updated_at, id, user_id] = params;
          let changes = 0;
          projects = projects.map(p => {
            if (p.id === id && p.user_id === user_id) {
              changes++;
              return { ...p, name, updated_at };
            }
            return p;
          });
          saveProjects();
          const context = { changes };
          if (callback) callback.call(context, null);
        } else if (sql.includes('UPDATE projects SET updated_at')) {
          // Restore path: timestamp-only update (must come after the SET-name
          // branch; matched separately so it can't silently no-op).
          const [updated_at, id, user_id] = params;
          let changes = 0;
          projects = projects.map(p => {
            if (p.id === id && p.user_id === user_id) {
              changes++;
              return { ...p, updated_at };
            }
            return p;
          });
          saveProjects();
          const context = { changes };
          if (callback) callback.call(context, null);
        } else if (sql.includes('UPDATE projects SET')) {
          // Unknown UPDATE shape — fail loudly instead of reporting success.
          const err = new Error(`Unsupported SQL: ${sql}`);
          if (callback) return callback(err);
          throw err;
        } else if (sql.includes('DELETE FROM projects')) {
          const [id, user_id] = params;
          const initialLen = projects.length;
          projects = projects.filter(p => !(p.id === id && p.user_id === user_id));
          saveProjects();
          const context = { changes: initialLen - projects.length };
          if (callback) callback.call(context, null);
        } else {
          // Fail loudly on unknown statements — silent success hid real bugs.
          const err = new Error(`Unsupported SQL: ${sql}`);
          if (callback) return callback(err);
          throw err;
        }
      } catch (err) {
        if (callback) callback(err);
      }
    }, 0);
  },

  get(sql, params = [], callback) {
    setTimeout(() => {
      try {
        if (sql.includes('SELECT * FROM users WHERE username = ?')) {
          const [username] = params;
          const user = users.find(u => u.username === username) || null;
          if (callback) callback(null, user);
        } else if (sql.includes('SELECT id, username, created_at FROM users WHERE id = ?')) {
          const [id] = params;
          const user = users.find(u => u.id === id);
          if (user) {
            if (callback) callback(null, { id: user.id, username: user.username, created_at: user.created_at });
          } else {
            if (callback) callback(null, null);
          }
        } else if (sql.includes('SELECT * FROM projects WHERE id = ? AND user_id = ?')) {
          const [id, user_id] = params;
          const proj = projects.find(p => p.id === id && p.user_id === user_id) || null;
          if (callback) callback(null, proj);
        } else {
          // Fail loudly like run() — returning null here once hid real bugs.
          const err = new Error(`Unsupported SQL: ${sql}`);
          if (callback) return callback(err);
          throw err;
        }
      } catch (err) {
        if (callback) callback(err);
      }
    }, 0);
  },

  all(sql, params = [], callback) {
    setTimeout(() => {
      try {
        if (sql.includes('SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ?')) {
          const [user_id] = params;
          const userProjects = projects
            .filter(p => p.user_id === user_id)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          if (callback) callback(null, userProjects);
        } else {
          // Fail loudly like run() — returning [] here once hid real bugs.
          const err = new Error(`Unsupported SQL: ${sql}`);
          if (callback) return callback(err);
          throw err;
        }
      } catch (err) {
        if (callback) callback(err);
      }
    }, 0);
  },

  serialize(fn) {
    if (fn) fn();
  }
};

export default db;
