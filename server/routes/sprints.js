import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireProjectAccess } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.param('projectId', requireProjectAccess);

// GET /api/projects/:projectId/sprints
router.get('/:projectId/sprints', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM sprints WHERE project_id = $1 ORDER BY number',
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list sprints' });
  }
});

// POST /api/projects/:projectId/sprints
router.post('/:projectId/sprints', async (req, res) => {
  const { number, label, start_date, end_date, weight_pct } = req.body;
  if (!number || !label || !start_date || !end_date) {
    return res.status(400).json({ error: 'number, label, start_date, end_date are required' });
  }
  try {
    const result = await query(`
      INSERT INTO sprints (project_id, number, label, start_date, end_date, weight_pct)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.params.projectId, number, label, start_date, end_date, weight_pct || 0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Sprint number already exists' });
    res.status(500).json({ error: 'Failed to create sprint' });
  }
});

// PATCH /api/projects/:projectId/sprints/:id
router.patch('/:projectId/sprints/:id', async (req, res) => {
  const { label, start_date, end_date, weight_pct } = req.body;
  try {
    const result = await query(`
      UPDATE sprints SET
        label = COALESCE($1, label),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        weight_pct = COALESCE($4, weight_pct)
      WHERE id = $5 AND project_id = $6
      RETURNING *
    `, [label, start_date, end_date, weight_pct, req.params.id, req.params.projectId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Sprint not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update sprint' });
  }
});

// DELETE /api/projects/:projectId/sprints/:id
router.delete('/:projectId/sprints/:id', async (req, res) => {
  try {
    await query('DELETE FROM sprints WHERE id = $1 AND project_id = $2', [req.params.id, req.params.projectId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete sprint' });
  }
});

export default router;
