import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireProjectAccess } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.param('projectId', requireProjectAccess);

// GET /api/projects/:projectId/teams
router.get('/:projectId/teams', async (req, res) => {
  try {
    const result = await query(`
      SELECT t.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pm.id, 'display_name', pm.display_name, 'github_login', pm.github_login, 'avatar_url', pm.avatar_url))
           FROM team_members tm JOIN project_members pm ON pm.id = tm.member_id
           WHERE tm.team_id = t.id), '[]'
        ) as members
      FROM teams t
      WHERE t.project_id = $1
      ORDER BY t.name
    `, [req.params.projectId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

// POST /api/projects/:projectId/teams
router.post('/:projectId/teams', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await query(
      'INSERT INTO teams (project_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [req.params.projectId, name, color || '#6366f1']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// PATCH /api/projects/:projectId/teams/:id
router.patch('/:projectId/teams/:id', async (req, res) => {
  const { name, color } = req.body;
  try {
    const result = await query(
      'UPDATE teams SET name = COALESCE($1, name), color = COALESCE($2, color) WHERE id = $3 AND project_id = $4 RETURNING *',
      [name, color, req.params.id, req.params.projectId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Team not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// DELETE /api/projects/:projectId/teams/:id
router.delete('/:projectId/teams/:id', async (req, res) => {
  try {
    await query('DELETE FROM teams WHERE id = $1 AND project_id = $2', [req.params.id, req.params.projectId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// POST /api/projects/:projectId/teams/:id/members — add member to team
router.post('/:projectId/teams/:id/members', async (req, res) => {
  const { member_id } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });
  try {
    await query(
      'INSERT INTO team_members (team_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, member_id]
    );
    res.status(201).json({ added: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member to team' });
  }
});

// DELETE /api/projects/:projectId/teams/:id/members/:memberId
router.delete('/:projectId/teams/:id/members/:memberId', async (req, res) => {
  try {
    await query('DELETE FROM team_members WHERE team_id = $1 AND member_id = $2', [req.params.id, req.params.memberId]);
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member from team' });
  }
});

export default router;
