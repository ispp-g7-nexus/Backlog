import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { fetchUserRepos, fetchUserOrgs, fetchOrgRepos } from '../lib/github-oauth.js';

const router = Router();
router.use(authenticate);

// GET /api/user/profile
router.get('/profile', (req, res) => {
  res.json({
    id: req.user.id,
    login: req.user.github_login,
    name: req.user.name,
    avatar_url: req.user.avatar_url,
  });
});

// GET /api/user/repos — all accessible repos (own + org)
router.get('/repos', async (req, res) => {
  try {
    const token = req.githubToken;
    if (!token) return res.status(400).json({ error: 'No GitHub token' });

    const [ownRepos, orgs] = await Promise.all([
      fetchUserRepos(token),
      fetchUserOrgs(token),
    ]);

    const orgRepos = [];
    for (const org of orgs) {
      const repos = await fetchOrgRepos(token, org.login);
      orgRepos.push(...repos);
    }

    // Deduplicate by id
    const seen = new Set();
    const all = [...ownRepos, ...orgRepos].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // Only repos where user has write access
    const writable = all.filter(r => r.permissions?.push || r.permissions?.admin);

    res.json(writable);
  } catch (err) {
    console.error('[User] repos error:', err.message);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// GET /api/user/repos/:owner/:repo/projects — list GitHub Projects for a repo
router.get('/repos/:owner/:repo/projects', async (req, res) => {
  const { owner, repo } = req.params;
  const token = req.githubToken;
  if (!token) return res.status(400).json({ error: 'No GitHub token' });

  try {
    const ghRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            projectsV2(first: 20) {
              nodes { id number title closed }
            }
          }
          organization(login: $owner) {
            projectsV2(first: 20) {
              nodes { id number title closed }
            }
          }
        }`,
        variables: { owner, repo },
      }),
    });
    const data = await ghRes.json();
    const repoProjects = data.data?.repository?.projectsV2?.nodes || [];
    const orgProjects = data.data?.organization?.projectsV2?.nodes || [];
    // Deduplicate
    const seen = new Set();
    const all = [...repoProjects, ...orgProjects].filter(p => {
      if (!p || seen.has(p.number)) return false;
      seen.add(p.number);
      return !p.closed;
    });
    res.json(all);
  } catch (err) {
    console.error('[User] projects error:', err.message);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

export default router;
