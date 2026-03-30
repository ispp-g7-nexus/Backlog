import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireProjectAccess } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.param('projectId', requireProjectAccess);

// --- Labels ---
// GET /api/projects/:projectId/labels
router.get('/:projectId/labels', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM custom_labels WHERE project_id = $1 ORDER BY category, name',
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list labels' });
  }
});

// POST /api/projects/:projectId/labels
router.post('/:projectId/labels', async (req, res) => {
  const { category, name, color } = req.body;
  if (!category || !name) return res.status(400).json({ error: 'category and name required' });
  try {
    const result = await query(
      'INSERT INTO custom_labels (project_id, category, name, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.projectId, category, name, color || '#71717a']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create label' });
  }
});

// DELETE /api/projects/:projectId/labels/:id
router.delete('/:projectId/labels/:id', async (req, res) => {
  try {
    await query('DELETE FROM custom_labels WHERE id = $1 AND project_id = $2', [req.params.id, req.params.projectId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// --- Metrics ---
// GET /api/projects/:projectId/metrics
router.get('/:projectId/metrics', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM metric_formulas WHERE project_id = $1 ORDER BY key',
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list metrics' });
  }
});

// PUT /api/projects/:projectId/metrics/:key
router.put('/:projectId/metrics/:key', async (req, res) => {
  const { formula, description } = req.body;
  if (!formula) return res.status(400).json({ error: 'formula required' });
  try {
    const result = await query(`
      INSERT INTO metric_formulas (project_id, key, formula, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, key) DO UPDATE SET formula = $3, description = $4
      RETURNING *
    `, [req.params.projectId, req.params.key, formula, description]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update metric' });
  }
});

// --- Cost Config ---
// GET /api/projects/:projectId/costs
router.get('/:projectId/costs', async (req, res) => {
  try {
    const [config, profiles] = await Promise.all([
      query('SELECT * FROM cost_config WHERE project_id = $1', [req.params.projectId]),
      query('SELECT * FROM cost_profiles WHERE project_id = $1 ORDER BY name', [req.params.projectId]),
    ]);
    res.json({ config: config.rows[0] || null, profiles: profiles.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get costs' });
  }
});

// PUT /api/projects/:projectId/costs/config
router.put('/:projectId/costs/config', async (req, res) => {
  const { hbs_rate, gg_pct, bi_pct, iva_pct, budget_total } = req.body;
  try {
    const result = await query(`
      INSERT INTO cost_config (project_id, hbs_rate, gg_pct, bi_pct, iva_pct, budget_total)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (project_id) DO UPDATE SET
        hbs_rate = COALESCE($2, cost_config.hbs_rate),
        gg_pct = COALESCE($3, cost_config.gg_pct),
        bi_pct = COALESCE($4, cost_config.bi_pct),
        iva_pct = COALESCE($5, cost_config.iva_pct),
        budget_total = COALESCE($6, cost_config.budget_total)
      RETURNING *
    `, [req.params.projectId, hbs_rate, gg_pct, bi_pct, iva_pct, budget_total]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cost config' });
  }
});

// POST /api/projects/:projectId/costs/profiles
router.post('/:projectId/costs/profiles', async (req, res) => {
  const { name, multiplier, hourly_rate, headcount } = req.body;
  if (!name || !hourly_rate) return res.status(400).json({ error: 'name and hourly_rate required' });
  try {
    const result = await query(
      'INSERT INTO cost_profiles (project_id, name, multiplier, hourly_rate, headcount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.projectId, name, multiplier || 1, hourly_rate, headcount || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create cost profile' });
  }
});

// DELETE /api/projects/:projectId/costs/profiles/:id
router.delete('/:projectId/costs/profiles/:id', async (req, res) => {
  try {
    await query('DELETE FROM cost_profiles WHERE id = $1 AND project_id = $2', [req.params.id, req.params.projectId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete cost profile' });
  }
});

// --- Risk Thresholds ---
// GET /api/projects/:projectId/risks
router.get('/:projectId/risks', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM risk_thresholds WHERE project_id = $1',
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list risk thresholds' });
  }
});

// PUT /api/projects/:projectId/risks/:key
router.put('/:projectId/risks/:key', async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  try {
    const result = await query(`
      INSERT INTO risk_thresholds (project_id, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, key) DO UPDATE SET value = $3
      RETURNING *
    `, [req.params.projectId, req.params.key, value]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update risk threshold' });
  }
});

// --- Saved Views ---
// GET /api/projects/:projectId/views
router.get('/:projectId/views', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM saved_views WHERE project_id = $1 ORDER BY name',
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list views' });
  }
});

// POST /api/projects/:projectId/views
router.post('/:projectId/views', async (req, res) => {
  const { name, config } = req.body;
  if (!name || !config) return res.status(400).json({ error: 'name and config required' });
  try {
    const result = await query(
      'INSERT INTO saved_views (project_id, user_id, name, config) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.projectId, req.user.id, name, JSON.stringify(config)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create view' });
  }
});

// DELETE /api/projects/:projectId/views/:id
router.delete('/:projectId/views/:id', async (req, res) => {
  try {
    await query('DELETE FROM saved_views WHERE id = $1 AND project_id = $2', [req.params.id, req.params.projectId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete view' });
  }
});

// --- Generic project config (JSONB) ---
// GET /api/projects/:projectId/config
router.get('/:projectId/config', async (req, res) => {
  try {
    const result = await query('SELECT config FROM projects WHERE id = $1', [req.params.projectId]);
    res.json(result.rows[0]?.config || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// PATCH /api/projects/:projectId/config/:section
router.patch('/:projectId/config/:section', async (req, res) => {
  try {
    const patch = JSON.stringify({ [req.params.section]: req.body });
    const result = await query(
      'UPDATE projects SET config = config || $2::jsonb WHERE id = $1 RETURNING config',
      [req.params.projectId, patch]
    );
    res.json(result.rows[0]?.config || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config section' });
  }
});

// --- Retro boards (stored in retro_boards table, keyed by sprint number) ---
// GET /api/projects/:projectId/retro/:sprint
router.get('/:projectId/retro/:sprint', async (req, res) => {
  try {
    const result = await query(
      'SELECT items FROM retro_boards WHERE project_id = $1 AND sprint_number = $2',
      [req.params.projectId, parseInt(req.params.sprint)]
    );
    res.json(result.rows[0]?.items || { good: [], improve: [], actions: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get retro' });
  }
});

// PUT /api/projects/:projectId/retro/:sprint
router.put('/:projectId/retro/:sprint', async (req, res) => {
  const { items } = req.body;
  if (!items) return res.status(400).json({ error: 'items required' });
  try {
    await query(`
      INSERT INTO retro_boards (project_id, sprint_number, items)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, sprint_number) DO UPDATE SET items = $3
    `, [req.params.projectId, parseInt(req.params.sprint), JSON.stringify(items)]);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save retro' });
  }
});

export default router;
