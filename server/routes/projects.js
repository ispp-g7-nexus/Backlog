import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/projects — list user's projects
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, pu.role as user_role
      FROM projects p
      JOIN project_users pu ON pu.project_id = p.id
      WHERE pu.user_id = $1
      ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('[Projects] list error:', err.message);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /api/projects — create project
router.post('/', async (req, res) => {
  const { github_org, github_repo, project_number, name } = req.body;
  if (!github_org || !github_repo || !project_number || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await query(`
      INSERT INTO projects (owner_id, github_org, github_repo, project_number, name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, github_org, github_repo, project_number, name]);

    const project = result.rows[0];

    // Add owner to project_users
    await query(`
      INSERT INTO project_users (project_id, user_id, role)
      VALUES ($1, $2, 'owner')
    `, [project.id, req.user.id]);

    // Create default metric formulas
    const defaultMetrics = [
      ['velocity', 'sum(points_done) / sprint_count', 'Story points completados por sprint'],
      ['rendimiento', 'h_done_est / h_clockify * 100', 'Eficiencia: trabajo real por hora invertida'],
      ['consumo', 'h_clockify / h_estimadas * 100', 'Gasto del presupuesto de horas'],
      ['completitud', 'h_done / h_estimadas * 100', 'Progreso del sprint'],
      ['collaboration', 'reviews / (commits + 1) * 50', 'Equilibrio producción/revisión'],
      ['pr_efficiency', 'merged_prs / total_prs * 100', 'Porcentaje de PRs mergeadas'],
      ['health_score', '0.3*norm(commits) + 0.3*norm(reviews) + 0.2*pr_eff + 0.2*consistency', 'Score compuesto personalizable'],
    ];
    for (const [key, formula, description] of defaultMetrics) {
      await query(`
        INSERT INTO metric_formulas (project_id, key, formula, description)
        VALUES ($1, $2, $3, $4)
      `, [project.id, key, formula, description]);
    }

    // Create default risk thresholds
    const defaultThresholds = [
      ['unassigned_days', 3],
      ['blocked_days', 5],
      ['concentration_pct', 30],
      ['estimation_deviation', 1.5],
    ];
    for (const [key, value] of defaultThresholds) {
      await query(`
        INSERT INTO risk_thresholds (project_id, key, value)
        VALUES ($1, $2, $3)
      `, [project.id, key, value]);
    }

    res.status(201).json(project);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Project already exists for this repo/project' });
    }
    console.error('[Projects] create error:', err.message);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, pu.role as user_role
      FROM projects p
      JOIN project_users pu ON pu.project_id = p.id
      WHERE p.id = $1 AND pu.user_id = $2
    `, [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req, res) => {
  const { name, config } = req.body;
  try {
    const sets = [];
    const vals = [];
    let idx = 1;
    if (name) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (config) { sets.push(`config = $${idx++}`); vals.push(JSON.stringify(config)); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id, req.user.id);
    const result = await query(`
      UPDATE projects SET ${sets.join(', ')}
      WHERE id = $${idx++} AND id IN (SELECT project_id FROM project_users WHERE user_id = $${idx} AND role IN ('owner','admin'))
      RETURNING *
    `, vals);
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found or no permission' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(`
      DELETE FROM projects
      WHERE id = $1 AND owner_id = $2
      RETURNING id
    `, [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found or not owner' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
