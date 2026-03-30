import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireProjectAccess } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.param('projectId', requireProjectAccess);

const GH_API = 'https://api.github.com';
const GH_GQL = 'https://api.github.com/graphql';

async function ghFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function ghGraphQL(token, queryStr, variables = {}) {
  const res = await fetch(GH_GQL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryStr, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

async function getProject(projectId) {
  const proj = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (!proj.rows[0]) throw Object.assign(new Error('Project not found'), { status: 404 });
  return proj.rows[0];
}

async function logActivity(projectId, userId, taskId, field, oldValue, newValue) {
  await query(
    'INSERT INTO activity_log (project_id, task_id, user_id, field, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
    [projectId, taskId, userId, field, oldValue, newValue]
  );
}

// POST /api/projects/:projectId/github/sync
router.post('/:projectId/github/sync', async (req, res) => {
  try {
    const { github_org, project_number } = await getProject(req.params.projectId);

    const items = [];
    let cursor = null;
    let hasNext = true;

    while (hasNext) {
      const data = await ghGraphQL(req.githubToken, `
        query($org: String!, $num: Int!, $cursor: String) {
          organization(login: $org) {
            projectV2(number: $num) {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content {
                    ... on Issue {
                      number title body state url
                      createdAt updatedAt closedAt
                      assignees(first: 5) { nodes { login name avatarUrl } }
                      labels(first: 10) { nodes { name color } }
                      milestone { title }
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { name } } }
                      ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
                      ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { name } } }
                      ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { name } } }
                      ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2IterationField { name } } }
                    }
                  }
                }
              }
            }
          }
        }
      `, { org: github_org, num: project_number, cursor });

      const project = data.organization?.projectV2;
      if (!project) throw new Error('Project not found on GitHub');

      const page = project.items;
      for (const node of page.nodes) {
        if (!node.content) continue;
        const fields = {};
        for (const fv of node.fieldValues.nodes) {
          const fname = fv.field?.name;
          if (!fname) continue;
          fields[fname] = fv.name || fv.text || fv.number || fv.date || fv.title;
        }
        items.push({
          id: node.id,
          number: node.content.number,
          title: node.content.title,
          body: node.content.body,
          state: node.content.state,
          url: node.content.url,
          status: fields['Status'],
          priority: fields['Priority'],
          size: fields['Size'],
          equipo: fields['Equipo'],
          tipo: fields['Tipo'],
          estimate: fields['Estimate'],
          startDate: fields['Start date'],
          targetDate: fields['Target date'],
          assignees: node.content.assignees?.nodes || [],
          labels: node.content.labels?.nodes || [],
          milestone: node.content.milestone?.title,
          createdAt: node.content.createdAt,
          updatedAt: node.content.updatedAt,
          closedAt: node.content.closedAt,
        });
      }

      hasNext = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    res.json({ fetchedAt: new Date().toISOString(), total: items.length, items });
  } catch (err) {
    console.error('[GitHub Proxy] sync error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/github/update-field
router.post('/:projectId/github/update-field', async (req, res) => {
  const { item_id, field_name, value, task_id, old_value } = req.body;
  try {
    const { github_org, project_number } = await getProject(req.params.projectId);

    const schema = await ghGraphQL(req.githubToken, `
      query($org: String!, $num: Int!) {
        organization(login: $org) {
          projectV2(number: $num) {
            id
            fields(first: 30) {
              nodes {
                ... on ProjectV2Field { id name }
                ... on ProjectV2SingleSelectField { id name options { id name } }
                ... on ProjectV2IterationField { id name }
              }
            }
          }
        }
      }
    `, { org: github_org, num: project_number });

    const projectGhId = schema.organization.projectV2.id;
    const field = schema.organization.projectV2.fields.nodes.find(f => f.name === field_name);
    if (!field) return res.status(400).json({ error: `Field "${field_name}" not found` });

    let fieldValue;
    if (field.options) {
      const opt = field.options.find(o => o.name === value);
      if (!opt) return res.status(400).json({ error: `Option "${value}" not found for field "${field_name}"` });
      fieldValue = { singleSelectOptionId: opt.id };
    } else if (typeof value === 'number') {
      fieldValue = { number: value };
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      fieldValue = { date: value };
    } else {
      fieldValue = { text: value };
    }

    await ghGraphQL(req.githubToken, `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
          projectV2Item { id }
        }
      }
    `, { projectId: projectGhId, itemId: item_id, fieldId: field.id, value: fieldValue });

    if (task_id) {
      await logActivity(req.params.projectId, req.user.id, task_id, field_name, old_value, String(value));
    }

    res.json({ updated: true });
  } catch (err) {
    console.error('[GitHub Proxy] update-field error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/github/issues
router.post('/:projectId/github/issues', async (req, res) => {
  const { title, body, labels, assignees, task_id } = req.body;
  try {
    const { github_org, github_repo } = await getProject(req.params.projectId);

    const issue = await ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, labels, assignees }),
    });

    if (task_id) {
      await logActivity(req.params.projectId, req.user.id, task_id, 'created', null, title);
    }

    res.status(201).json(issue);
  } catch (err) {
    console.error('[GitHub Proxy] create issue error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /api/projects/:projectId/github/issues/:number
router.patch('/:projectId/github/issues/:number', async (req, res) => {
  try {
    const { github_org, github_repo } = await getProject(req.params.projectId);

    const issue = await ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/issues/${req.params.number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    res.json(issue);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/github/issues/:number/assignees
router.post('/:projectId/github/issues/:number/assignees', async (req, res) => {
  const { assignees } = req.body;
  try {
    const { github_org, github_repo } = await getProject(req.params.projectId);

    const result = await ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/issues/${req.params.number}/assignees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignees }),
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId/github/issues/:number/assignees
router.delete('/:projectId/github/issues/:number/assignees', async (req, res) => {
  const { assignees } = req.body;
  try {
    const { github_org, github_repo } = await getProject(req.params.projectId);

    const result = await ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/issues/${req.params.number}/assignees`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignees }),
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/github/stats
router.get('/:projectId/github/stats', async (req, res) => {
  try {
    const { github_org, github_repo } = await getProject(req.params.projectId);

    const [contributors, commitActivity, codeFreq] = await Promise.all([
      ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/stats/contributors`),
      ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/stats/commit_activity`),
      ghFetch(req.githubToken, `${GH_API}/repos/${github_org}/${github_repo}/stats/code_frequency`),
    ]);

    const prData = await ghGraphQL(req.githubToken, `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              number title state createdAt mergedAt
              author { login }
              additions deletions
              reviews(first: 50) { nodes { author { login } } }
            }
          }
        }
      }
    `, { owner: github_org, repo: github_repo });

    res.json({
      contributors: Array.isArray(contributors) ? contributors : [],
      commitActivity: Array.isArray(commitActivity) ? commitActivity : [],
      codeFrequency: Array.isArray(codeFreq) ? codeFreq : [],
      pullRequests: prData.repository?.pullRequests?.nodes || [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GitHub Proxy] stats error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/github/activity
router.get('/:projectId/github/activity', async (req, res) => {
  const { limit = 50 } = req.query;
  try {
    const result = await query(`
      SELECT al.*, u.github_login, u.name as user_name, u.avatar_url
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `, [req.params.projectId, Math.min(parseInt(limit), 200)]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;
