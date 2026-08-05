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

try {
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    nextUserId = users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;
  }
} catch (e) {
  users = [];
}

try {
  if (fs.existsSync(projectsFile)) {
    projects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
  }
} catch (e) {
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
          const newProject = { id, user_id, name, created_at, updated_at };
          projects.push(newProject);
          saveProjects();
          const context = { lastID: id, changes: 1 };
          if (callback) callback.call(context, null);
        } else if (sql.includes('UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')) {
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
        } else if (sql.includes('UPDATE projects SET name = ?')) {
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
        } else if (sql.includes('DELETE FROM projects')) {
          const [id, user_id] = params;
          const initialLen = projects.length;
          projects = projects.filter(p => !(p.id === id && p.user_id === user_id));
          saveProjects();
          const context = { changes: initialLen - projects.length };
          if (callback) callback.call(context, null);
        } else {
          if (callback) callback.call({ lastID: 0, changes: 0 }, null);
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
          if (callback) callback(null, null);
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
          if (callback) callback(null, []);
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
