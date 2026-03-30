import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireProjectAccess } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.param('projectId', requireProjectAccess);

// GET /api/projects/:projectId/members
router.get('/:projectId/members', async (req, res) => {
  try {
    const result = await query(`
      SELECT pm.*,
        COALESCE(
          (SELECT json_agg(json_build_object('team_id', t.id, 'team_name', t.name, 'team_color', t.color))
           FROM team_members tm JOIN teams t ON t.id = tm.team_id
           WHERE tm.member_id = pm.id), '[]'
        ) as teams
      FROM project_members pm
      WHERE pm.project_id = $1
      ORDER BY pm.display_name
    `, [req.params.projectId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// POST /api/projects/:projectId/members
router.post('/:projectId/members', async (req, res) => {
  const { github_login, display_name, email, clockify_name, role, avatar_url } = req.body;
  if (!display_name) return res.status(400).json({ error: 'display_name is required' });

  try {
    const result = await query(`
      INSERT INTO project_members (project_id, github_login, display_name, email, clockify_name, role, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.params.projectId, github_login, display_name, email, clockify_name, role || 'dev', avatar_url]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// POST /api/projects/:projectId/members/import — import from GitHub collaborators
router.post('/:projectId/members/import', async (req, res) => {
  const token = req.githubToken;
  if (!token) return res.status(400).json({ error: 'No GitHub token' });

  try {
    const project = await query('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
    if (!project.rows[0]) return res.status(404).json({ error: 'Project not found' });
    const { github_org, github_repo } = project.rows[0];

    const ghRes = await fetch(`https://api.github.com/repos/${github_org}/${github_repo}/collaborators?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const collabs = await ghRes.json();
    if (!Array.isArray(collabs)) return res.status(502).json({ error: 'Failed to fetch collaborators' });

    const imported = [];
    for (const c of collabs) {
      const result = await query(`
        INSERT INTO project_members (project_id, github_login, display_name, avatar_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [req.params.projectId, c.login, c.login, c.avatar_url]);
      if (result.rows[0]) imported.push(result.rows[0]);
    }

    res.json({ imported: imported.length, members: imported });
  } catch (err) {
    console.error('[Members] import error:', err.message);
    res.status(500).json({ error: 'Failed to import members' });
  }
});

// PATCH /api/projects/:projectId/members/:id
router.patch('/:projectId/members/:id', async (req, res) => {
  const { display_name, email, clockify_name, role, avatar_url, github_login } = req.body;
  try {
    const sets = [];
    const vals = [];
    let idx = 1;
    if (display_name !== undefined) { sets.push(`display_name = $${idx++}`); vals.push(display_name); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); vals.push(email); }
    if (clockify_name !== undefined) { sets.push(`clockify_name = $${idx++}`); vals.push(clockify_name); }
    if (role !== undefined) { sets.push(`role = $${idx++}`); vals.push(role); }
    if (avatar_url !== undefined) { sets.push(`avatar_url = $${idx++}`); vals.push(avatar_url); }
    if (github_login !== undefined) { sets.push(`github_login = $${idx++}`); vals.push(github_login); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id, req.params.projectId);
    const result = await query(
      `UPDATE project_members SET ${sets.join(', ')} WHERE id = $${idx++} AND project_id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/projects/:projectId/members/:id
router.delete('/:projectId/members/:id', async (req, res) => {
  try {
    await query('DELETE FROM project_members WHERE id = $1 AND project_id = $2', [req.params.id, req.params.projectId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

export default router;
