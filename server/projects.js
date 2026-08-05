import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db, { projectsDir } from './db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

const sanitizePath = (str) => String(str || '').replace(/[^a-zA-Z0-9_-]/g, '');

// Helper to get user project file path
const getProjectPath = (username, projectId) => {
  const cleanUser = sanitizePath(username);
  const cleanId = sanitizePath(projectId);
  return path.join(projectsDir, cleanUser, `${cleanId}.ncraft`);
};

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
  const { name, template } = req.body;

  const projectId = uuidv4();
  const projectName = name ? name.trim() : 'Untitled Diagram';
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
  try {
    const userFolder = path.join(projectsDir, sanitizePath(username));
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    const filePath = getProjectPath(username, projectId);
    fs.writeFileSync(filePath, JSON.stringify(projectFileEnvelope, null, 2), 'utf8');
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
      } catch (e) {
        res.status(500).json({ error: 'Corrupted project file' });
      }
    }
  );
});

// PUT /api/projects/:id — Update project diagram data (Save / Auto-save)
router.put('/:id', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const { data, name } = req.body;

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }

      const now = new Date().toISOString();
      const updatedName = name ? name.trim() : project.name;

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
        fs.writeFileSync(filePath, JSON.stringify(projectFileEnvelope, null, 2), 'utf8');
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

// PUT /api/projects/:id/rename — Rename project
router.put('/:id/rename', authenticateToken, (req, res) => {
  const { userId, username } = req.user;
  const projectId = req.params.id;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const cleanName = name.trim();
  const now = new Date().toISOString();

  db.get(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [projectId, userId],
    (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Update envelope file
      const filePath = getProjectPath(username, projectId);
      if (fs.existsSync(filePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (content.meta) content.meta.name = cleanName;
          content.updatedAt = now;
          fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
        } catch (e) {
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
        } catch (e) {
          // ignore if unlinking fails
        }
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
