// E2E repro for NodeCraft server bugs — boots the real server on an
// ephemeral port and exercises the buggy routes over HTTP.
// Run: node repro-bugs.mjs   (from F:/Dev/NodeCraft)
// Backs up server/data/*.json before running and restores afterwards,
// and deletes any project files it creates.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3457;
const BASE = `http://localhost:${PORT}`;
const env = { ...process.env, PORT: String(PORT), JWT_SECRET: 'repro-test-secret' };

const dataDir = path.join(__dirname, 'server', 'data');
const projectsDir = path.join(__dirname, 'server', 'projects');
const backups = new Map();
for (const f of ['users.json', 'projects.json', 'nodecraft.db', 'nodecraft.db-wal', 'nodecraft.db-shm']) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) backups.set(p, fs.readFileSync(p));
}
const createdDirs = new Set();

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

const server = spawn(process.execPath, ['server/index.js'], { env, cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
server.on('error', (err) => console.error('Failed to spawn server:', err));
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('server did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('NodeCraft Server running')) { clearTimeout(t); resolve(); } });
  server.stderr.on('data', (d) => process.stderr.write(d));
});
server.on('exit', (c) => { if (c !== null && c !== 0) console.error(`server exited ${c}`); });

const uname = `repro${Date.now().toString(36)}`;
const pw = 'repro-pass-123';
let token = '', projectId = '', userFolder = '';

try {
  // register
  let r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: pw }),
  });
  check('register 201', r.status === 201, `status=${r.status}`);
  const reg = await r.json().catch(() => ({}));
  token = reg.token || '';
  userFolder = path.join(projectsDir, uname);
  createdDirs.add(userFolder);
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // create project
  r = await fetch(`${BASE}/api/projects`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'repro' }) });
  const created = await r.json().catch(() => ({}));
  projectId = created.project?.id || '';
  check('create project 201', r.status === 201 && !!projectId, `status=${r.status}`);

  // snapshot v1
  r = await fetch(`${BASE}/api/projects/${projectId}/versions`, { method: 'POST', headers: H, body: JSON.stringify({ label: 'v1' }) });
  const snap = await r.json().catch(() => ({}));
  check('snapshot seq=1', r.status === 201 && snap.version?.seq === 1, `status=${r.status}`);

  // BUG A (lax seq): DELETE '1abc' must be 400, must NOT delete v1
  r = await fetch(`${BASE}/api/projects/${projectId}/versions/1abc`, { method: 'DELETE', headers: H });
  const t1 = await r.text();
  check("DELETE versions/'1abc' rejected with 400", r.status === 400, `status=${r.status} body=${t1.slice(0, 80)}`);
  r = await fetch(`${BASE}/api/projects/${projectId}/versions`, { headers: H });
  const list = await r.json().catch(() => ({}));
  check('v1 still exists after lax delete attempt', (list.versions || []).some((v) => v.seq === 1), JSON.stringify(list.versions || []));

  // BUG B (rename crash): non-string name must be 400 JSON, not 500 HTML
  r = await fetch(`${BASE}/api/projects/${projectId}/rename`, { method: 'PUT', headers: H, body: JSON.stringify({ name: 12345 }) });
  const t2 = await r.text();
  let isJson = false; try { JSON.parse(t2); isJson = true; } catch {}
  check('rename non-string name -> 400 JSON', r.status === 400 && isJson, `status=${r.status} body=${t2.slice(0, 80)}`);

  // BUG C (empty body crash): POST with no body must not 500
  r = await fetch(`${BASE}/api/projects`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const t3 = await r.text();
  let ok3 = false; try { const j = JSON.parse(t3); ok3 = (r.status === 201 && !!j.project) || (r.status >= 400 && r.status < 500); } catch {}
  check('POST /projects with no body does not 500', r.status !== 500 && ok3, `status=${r.status} body=${t3.slice(0, 80)}`);

  // BUG D (empty/non-alphanumeric project id): must not access .ncraft dotfile
  r = await fetch(`${BASE}/api/projects/$$$`, { headers: H });
  check('GET /projects/$$$ returns 404', r.status === 404, `status=${r.status}`);
  r = await fetch(`${BASE}/api/projects/$$$/versions`, { headers: H });
  check('GET /projects/$$$/versions returns 404', r.status === 404, `status=${r.status}`);

  // Regression: rename + restore roundtrip still work
  r = await fetch(`${BASE}/api/projects/${projectId}/rename`, { method: 'PUT', headers: H, body: JSON.stringify({ name: 'renamed' }) });
  check('rename valid name 200', r.status === 200, `status=${r.status}`);
  r = await fetch(`${BASE}/api/projects/${projectId}/versions/1/restore`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const rest = await r.json().catch(() => ({}));
  check('restore v1 200 + name reverted', r.status === 200 && rest.name === 'repro', `status=${r.status} name=${rest.name}`);

  // BUG E (Template endpoints): POST /projects with template='database' creates 3 cylinder schema nodes with hex colors
  r = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ name: 'db-test', template: 'database' })
  });
  const dbProj = await r.json().catch(() => ({}));
  const dbProjId = dbProj.project?.id;
  check('create database template project 201', r.status === 201 && !!dbProjId, `status=${r.status}`);
  if (dbProjId) {
    const fileR = await fetch(`${BASE}/api/projects/${dbProjId}`, { headers: H });
    const fileJson = await fileR.json().catch(() => ({}));
    const nodes = fileJson.project?.data?.nodes || [];
    check('database template contains 3 cylinder nodes', nodes.length === 3 && nodes.every((n) => n.data?.shapeType === 'cylinder'), `nodes=${nodes.length}`);
    check('database template nodes use hex colors', nodes.every((n) => !n.data?.color || n.data.color.startsWith('#')), `colors=${nodes.map((n) => n.data?.color)}`);
    await fetch(`${BASE}/api/projects/${dbProjId}`, { method: 'DELETE', headers: H }).catch(() => {});
  }
} finally {
  try {
    if (projectId && token) {
      await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  } catch {}
  await new Promise((res) => { server.kill(); setTimeout(res, 500); });
  for (const d of createdDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
  for (const [p, content] of backups) { try { fs.writeFileSync(p, content); } catch {} }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
