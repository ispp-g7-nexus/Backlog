import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool.js';
import { encrypt } from '../lib/encrypt.js';
import { signToken } from '../middleware/auth.js';
import { getAuthUrl, exchangeCode, fetchGitHubUser } from '../lib/github-oauth.js';

const router = Router();

// GET /auth/github — redirect to GitHub OAuth
router.get('/github', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // In production, store state in session/cookie for CSRF protection
  res.redirect(getAuthUrl(state));
});

// GET /auth/callback — GitHub OAuth callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const githubToken = await exchangeCode(code);
    const ghUser = await fetchGitHubUser(githubToken);

    // Upsert user
    const result = await query(`
      INSERT INTO users (github_id, github_login, name, avatar_url, github_token)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (github_id) DO UPDATE SET
        github_login = EXCLUDED.github_login,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        github_token = EXCLUDED.github_token
      RETURNING id, github_login, name, avatar_url
    `, [ghUser.id, ghUser.login, ghUser.name || ghUser.login, ghUser.avatar_url, encrypt(githubToken)]);

    const user = result.rows[0];
    const token = signToken({ userId: user.id, login: user.github_login });

    // Redirect to frontend with JWT
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?token=${token}`);
  } catch (err) {
    console.error('[Auth] OAuth error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /auth/me — get current user
router.get('/me', async (req, res) => {
  // authenticate middleware should be applied before this
  res.json({
    id: req.user.id,
    login: req.user.github_login,
    name: req.user.name,
    avatar_url: req.user.avatar_url,
  });
});

export default router;
