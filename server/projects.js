import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db, { projectsDir } from './db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

const sanitizePath = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');

// Atomic file write: write to temp file then rename (crash-safe, avoids corruption)
function atomicWriteFileSync(filePath, content) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// Helper to get user project file path
const getProjectPath = (username, projectId) => {
  const cleanUser = sanitizePath(username);
  const cleanId = sanitizePath(projectId);
  // Defense-in-depth: ensure resolved path stays inside projectsDir
  const full = path.join(projectsDir, cleanUser, `${cleanId}.ncraft`);
  const resolved = path.resolve(full);
  const base = path.resolve(projectsDir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error('Invalid project path');
  return resolved;
};

function validateDiagramData(data) {
  if (!data || typeof data !== 'object') return 'Invalid diagram data';
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return 'Invalid diagram data format';
  if (data.nodes.length > 800) return 'Too many nodes (max 800)';
  if (data.edges.length > 1500) return 'Too many edges (max 1500)';
  const payloadSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
  if (payloadSize > 2_000_000) return 'Diagram too large (max 2MB)';
  for (const n of data.nodes) {
    if (!n || typeof n !== 'object') return 'Invalid node';
    if (typeof n.id !== 'string' || n.id.length < 1 || n.id.length > 100) return 'Invalid node id';
    if (n.position && (typeof n.position.x !== 'number' || typeof n.position.y !== 'number' || !Number.isFinite(n.position.x) || !Number.isFinite(n.position.y))) return 'Invalid node position';
    if (n.data && typeof n.data.label !== 'undefined' && typeof n.data.label !== 'string') return 'Invalid label';
    if (n.data && typeof n.data.label === 'string' && n.data.label.length > 5000) return 'Label too long';
  }
  for (const e of data.edges) {
    if (!e || typeof e !== 'object') return 'Invalid edge';
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') return 'Invalid edge';
    if (e.id.length < 1 || e.id.length > 100 || e.source.length < 1 || e.source.length > 100 || e.target.length < 1 || e.target.length > 100) return 'Invalid edge';
    if (typeof e.label !== 'undefined' && typeof e.label !== 'string') return 'Invalid edge label';
  }
  return null;
}

function parseVersionSeq(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const seq = Number(raw);
  return Number.isSafeInteger(seq) ? seq : null;
}

// GET /api/projects — List all user projects
router.get('/', authenticateToken, (req, res) => {
  const { userId } = req.user;

  db.all(
    `SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }
      res.json({ projects: rows || [] });
    }
  );
});

// POST /api/projects — Create a new project
router.post('/', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const { name, template } = req.body ?? {};

  const projectId = uuidv4();
  const projectName = typeof name === 'string' && name.trim() ? name.trim().substring(0, 100) : 'Untitled Diagram';
  const now = new Date().toISOString();

  // Initial diagram data structure
  let initialDiagramData = {
    nodes: [
      {
        id: '1',
        type: 'shape',
        position: { x: 250, y: 250 },
        data: { label: 'Start Here', shapeType: 'rectangle' }
      }
    ],
    edges: [],
    theme: 'light',
    snapToGrid: true,
    gridSize: 20,
    gridType: 'dots',
    canvasColor: null,
    boardNotes: ''
  };

  // If a template was requested
  if (template === 'mindmap') {
    initialDiagramData.nodes = [
      { id: '1', type: 'shape', position: { x: 400, y: 300 }, data: { label: 'Main Topic', shapeType: 'circle', color: 'bg-blue-500' } },
      { id: '2', type: 'shape', position: { x: 200, y: 150 }, data: { label: 'Subtopic 1', shapeType: 'sticky' } },
      { id: '3', type: 'shape', position: { x: 600, y: 150 }, data: { label: 'Subtopic 2', shapeType: 'sticky' } },
      { id: '4', type: 'shape', position: { x: 200, y: 450 }, data: { label: 'Subtopic 3', shapeType: 'sticky' } },
      { id: '5', type: 'shape', position: { x: 600, y: 450 }, data: { label: 'Subtopic 4', shapeType: 'sticky' } }
    ];
    initialDiagramData.edges = [
      { id: 'e1-2', source: '1', target: '2', animated: true },
      { id: 'e1-3', source: '1', target: '3', animated: true },
      { id: 'e1-4', source: '1', target: '4', animated: true },
      { id: 'e1-5', source: '1', target: '5', animated: true }
    ];
  } else if (template === 'flowchart') {
    initialDiagramData.nodes = [
      { id: '1', type: 'shape', position: { x: 400, y: 100 }, data: { label: 'Start', shapeType: 'circle', color: 'bg-emerald-500' } },
      { id: '2', type: 'shape', position: { x: 400, y: 220 }, data: { label: 'Process Data', shapeType: 'rectangle' } },
      { id: '3', type: 'shape', position: { x: 400, y: 360 }, data: { label: 'Is Valid?', shapeType: 'diamond', color: 'bg-amber-500' } },
      { id: '4', type: 'shape', position: { x: 250, y: 500 }, data: { label: 'Log Error', shapeType: 'rectangle', color: 'bg-rose-500' } },
      { id: '5', type: 'shape', position: { x: 550, y: 500 }, data: { label: 'Save Record', shapeType: 'cylinder', color: 'bg-indigo-500' } }
    ];
    initialDiagramData.edges = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4', label: 'No' },
      { id: 'e3-5', source: '3', target: '5', label: 'Yes' }
    ];
  }

  const projectFileEnvelope = {
    meta: {
      id: projectId,
      name: projectName,
      owner: username,
      createdAt: now,
      updatedAt: now
    },
    data: initialDiagramData
  };

  // Write file to disk
  let createdFilePath = null;
  try {
    const userFolder = path.join(projectsDir, sanitizePath(username));
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    const filePath = getProjectPath(username, projectId);
    createdFilePath = filePath;
    atomicWriteFileSync(filePath, JSON.stringify(projectFileEnvelope, null, 2));
  } catch (fsErr) {
    console.error('File write error:', fsErr);
    return res.status(500).json({ error: 'Failed to create project file on server' });
  }

  // Record in DB
  db.run(
    `INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [projectId, userId, projectName, now, now],
    function (err) {
      if (err) {
        // Cleanup orphan file
        if (createdFilePath) {
          try { fs.unlinkSync(createdFilePath); } catch {}
        }
        return res.status(500).json({ error: 'Failed to create project record' });
      }
      res.status(201).json({
        project: {
          id: projectId,
          name: projectName,
          created_at: now,
          updated_at: now
        }
      });
    }
  );
});

// GET /api/projects/:id — Get full project content
router.get('/:id', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const filePath = getProjectPath(username, projectId);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Project file missing on server' });
      }

      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        res.json({
          project: {
            id: project.id,
            name: project.name,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
            data: parsed.data || parsed
          }
        });
      } catch {
        res.status(500).json({ error: 'Corrupted project file' });
      }
    }
  );
});

// PUT /api/projects/:id — Update project diagram data (Save / Auto-save)
router.put('/:id', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const { data, name } = req.body ?? {};

  const validationError = validateDiagramData(data);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }

      const now = new Date().toISOString();
      const updatedName = typeof name === 'string' && name.trim() ? name.trim().substring(0, 100) : project.name;

      const projectFileEnvelope = {
        meta: {
          id: projectId,
          name: updatedName,
          owner: username,
          createdAt: project.created_at,
          updatedAt: now
        },
        data: data
      };

      const filePath = getProjectPath(username, projectId);
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        atomicWriteFileSync(filePath, JSON.stringify(projectFileEnvelope, null, 2));
      } catch (fsErr) {
        console.error('Save file error:', fsErr);
        return res.status(500).json({ error: 'Failed to save project file to server' });
      }

      db.run(
        `UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [updatedName, now, projectId, userId],
        function (dbErr) {
          if (dbErr) {
            return res.status(500).json({ error: 'Failed to update project timestamp' });
          }
          res.json({
            message: 'Project saved successfully',
            updatedAt: now,
            name: updatedName
          });
        }
      );
    }
  );
});

// ---------- Version history ----------
// Snapshots live in server/projects/<user>/<projectId>.versions/ as
//   v<seq>.ncraft (full envelope copy) + index.json [{seq, createdAt, label, name, size}]
const MAX_VERSIONS_PER_PROJECT = 20;

function getVersionsDir(username, projectId) {
  const cleanUser = sanitizePath(username);
  const cleanId = sanitizePath(projectId);
  const dir = path.resolve(path.join(projectsDir, cleanUser, `${cleanId}.versions`));
  if (dir !== path.resolve(projectsDir) && !dir.startsWith(path.resolve(projectsDir) + path.sep)) throw new Error('Invalid versions path');
  return dir;
}

function readVersionIndex(versionsDir) {
  const indexFile = path.join(versionsDir, 'index.json');
  if (!fs.existsSync(indexFile)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeVersionIndex(versionsDir, index) {
  atomicWriteFileSync(path.join(versionsDir, 'index.json'), JSON.stringify(index, null, 2));
}

// Next snapshot seq, tolerating hand-edited index entries without a numeric
// seq (Math.max with undefined would poison the result to NaN and overwrite
// an existing vNaN.ncraft / v1.ncraft).
function nextVersionSeq(index) {
  const max = index.reduce((m, v) => (Number.isInteger(v?.seq) ? Math.max(m, v.seq) : m), 0);
  return max + 1;
}

// POST /api/projects/:id/versions — snapshot the CURRENT server-side project file
router.post('/:id/versions', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 100) : '';

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) return res.status(404).json({ error: 'Project not found' });

      const mainFile = getProjectPath(username, projectId);
      if (!fs.existsSync(mainFile)) {
        return res.status(404).json({ error: 'Project file missing on server' });
      }

      try {
        const versionsDir = getVersionsDir(username, projectId);
        if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true });

        const index = readVersionIndex(versionsDir);
        const seq = nextVersionSeq(index);

        // Copy first, then stat the copy (avoids TOCTOU with concurrent autosave)
        const destFile = path.join(versionsDir, `v${seq}.ncraft`);
        fs.copyFileSync(mainFile, destFile);
        const size = fs.statSync(destFile).size;

        index.push({ seq, createdAt: new Date().toISOString(), label, name: project.name, size });
        // Prune oldest beyond cap
        while (index.length > MAX_VERSIONS_PER_PROJECT) {
          const oldest = index.shift();
          const oldFile = path.join(versionsDir, `v${oldest.seq}.ncraft`);
          try {
            if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
          } catch (pruneErr) {
            console.warn('Version prune warning:', pruneErr.message);
          }
        }
        writeVersionIndex(versionsDir, index);

        res.status(201).json({ message: 'Version saved', version: index[index.length - 1] });
      } catch (fsErr) {
        console.error('Version snapshot error:', fsErr);
        res.status(500).json({ error: 'Failed to save version' });
      }
    }
  );
});

// GET /api/projects/:id/versions — list snapshots (newest first)
router.get('/:id/versions', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) return res.status(404).json({ error: 'Project not found' });
      try {
        const versionsDir = getVersionsDir(username, projectId);
        const index = readVersionIndex(versionsDir)
          .slice()
          .sort((a, b) => b.seq - a.seq);
        res.json({ versions: index });
      } catch {
        res.status(500).json({ error: 'Failed to list versions' });
      }
    }
  );
});

// GET /api/projects/:id/versions/:seq — fetch a snapshot's diagram data
router.get('/:id/versions/:seq', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const seq = parseVersionSeq(req.params.seq);

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) return res.status(404).json({ error: 'Project not found' });
      if (seq === null) return res.status(400).json({ error: 'Invalid version number' });

      try {
        const versionsDir = getVersionsDir(username, projectId);
        const versionFile = path.join(versionsDir, `v${seq}.ncraft`);
        if (!fs.existsSync(versionFile)) return res.status(404).json({ error: 'Version not found' });
        const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        res.json({ version: { seq, name: parsed.meta?.name || project.name, data: parsed.data || parsed } });
      } catch {
        res.status(500).json({ error: 'Corrupted version file' });
      }
    }
  );
});

// POST /api/projects/:id/versions/:seq/restore — copy snapshot over the live file
router.post('/:id/versions/:seq/restore', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const seq = parseVersionSeq(req.params.seq);

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) return res.status(404).json({ error: 'Project not found' });
      if (seq === null) return res.status(400).json({ error: 'Invalid version number' });

      try {
        const versionsDir = getVersionsDir(username, projectId);
        const index = readVersionIndex(versionsDir);
        if (!index.some(v => v.seq === seq)) return res.status(404).json({ error: 'Version not found' });

        const versionFile = path.join(versionsDir, `v${seq}.ncraft`);
        if (!fs.existsSync(versionFile)) return res.status(404).json({ error: 'Version not found' });

        const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        // Never restore unchecked data — a corrupt snapshot must not brick the live file.
        const diagramData = parsed.data || parsed;
        const validationError = validateDiagramData(diagramData);
        if (validationError) return res.status(422).json({ error: `Snapshot is corrupt: ${validationError}` });

        const now = new Date().toISOString();
        const restoredName = typeof parsed.meta?.name === 'string' && parsed.meta.name.trim()
          ? parsed.meta.name.trim().substring(0, 100)
          : project.name;

        // Auto-snapshot current work before overwriting so restore is reversible.
        try {
          const liveFile = getProjectPath(username, projectId);
          if (fs.existsSync(liveFile)) {
            if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true });
            const vIndex = readVersionIndex(versionsDir);
            const vSeq = nextVersionSeq(vIndex);
            const vDest = path.join(versionsDir, `v${vSeq}.ncraft`);
            fs.copyFileSync(liveFile, vDest);
            const vSize = fs.statSync(vDest).size;
            vIndex.push({ seq: vSeq, createdAt: now, label: 'pre-restore backup', name: project.name, size: vSize });
            while (vIndex.length > MAX_VERSIONS_PER_PROJECT) {
              const oldest = vIndex.shift();
              try {
                const oldFile = path.join(versionsDir, `v${oldest.seq}.ncraft`);
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
              } catch {}
            }
            writeVersionIndex(versionsDir, vIndex);
          }
        } catch (backupErr) {
          console.warn('Pre-restore backup warning:', backupErr.message);
        }

        // Refresh envelope meta on restore so timestamps stay coherent
        const restoredEnvelope = {
          ...parsed,
          data: diagramData,
          meta: { ...(parsed.meta || {}), id: projectId, name: restoredName, updatedAt: now },
        };
        atomicWriteFileSync(getProjectPath(username, projectId), JSON.stringify(restoredEnvelope, null, 2));

        db.run(
          `UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          [restoredName, now, projectId, userId],
          (dbErr) => {
            if (dbErr) return res.status(500).json({ error: 'Restored file but failed to update timestamp' });
            res.json({
              message: 'Version restored',
              restoredAt: now,
              name: restoredName,
              data: diagramData,
            });
          }
        );
      } catch (fsErr) {
        console.error('Restore error:', fsErr);
        res.status(500).json({ error: 'Failed to restore version' });
      }
    }
  );
});

// DELETE /api/projects/:id/versions/:seq — remove a snapshot
router.delete('/:id/versions/:seq', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const seq = parseVersionSeq(req.params.seq);

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) return res.status(404).json({ error: 'Project not found' });
      if (seq === null) return res.status(400).json({ error: 'Invalid version number' });

      try {
        const versionsDir = getVersionsDir(username, projectId);
        const index = readVersionIndex(versionsDir);
        const next = index.filter(v => v.seq !== seq);
        if (next.length === index.length) return res.status(404).json({ error: 'Version not found' });

        const versionFile = path.join(versionsDir, `v${seq}.ncraft`);
        if (fs.existsSync(versionFile)) fs.unlinkSync(versionFile);
        writeVersionIndex(versionsDir, next);

        res.json({ message: 'Version deleted' });
      } catch (fsErr) {
        console.error('Version delete error:', fsErr);
        res.status(500).json({ error: 'Failed to delete version' });
      }
    }
  );
});

// PUT /api/projects/:id/rename — Rename project
router.put('/:id/rename', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const { name } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const cleanName = name.trim().substring(0, 100);
  const now = new Date().toISOString();

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Update envelope file (atomic)
      const filePath = getProjectPath(username, projectId);
      if (fs.existsSync(filePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (content.meta) {
            content.meta.name = cleanName;
            content.meta.updatedAt = now;
          }
          content.updatedAt = now;
          atomicWriteFileSync(filePath, JSON.stringify(content, null, 2));
        } catch {
          // continue
        }
      }

      db.run(
        `UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [cleanName, now, projectId, userId],
        (dbErr) => {
          if (dbErr) {
            return res.status(500).json({ error: 'Failed to rename project' });
          }
          res.json({ message: 'Project renamed', name: cleanName, updatedAt: now });
        }
      );
    }
  );
});

// DELETE /api/projects/:id — Delete project
router.delete('/:id', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Remove file from disk
      const filePath = getProjectPath(username, projectId);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn(`Warning: Failed to delete project file ${filePath}:`, unlinkErr.message);
        }
      }

      // Remove the version-history directory too — otherwise every deleted
      // project leaks up to MAX_VERSIONS_PER_PROJECT snapshot files forever.
      try {
        const versionsDir = getVersionsDir(username, projectId);
        if (fs.existsSync(versionsDir)) {
          fs.rmSync(versionsDir, { recursive: true, force: true });
        }
      } catch (versionsErr) {
        console.warn('Warning: Failed to delete project versions dir:', versionsErr.message);
      }

      db.run(
        `DELETE FROM projects WHERE id = ? AND user_id = ?`,
        [projectId, userId],
        (dbErr) => {
          if (dbErr) {
            return res.status(500).json({ error: 'Failed to delete project from database' });
          }
          res.json({ message: 'Project deleted successfully' });
        }
      );
    }
  );
});

export default router;
