import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool.js';
import { encrypt } from '../lib/encrypt.js';
import { signToken, authenticate } from '../middleware/auth.js';
import { getAuthUrl, exchangeCode, fetchGitHubUser } from '../lib/github-oauth.js';

const router = Router();

// In-memory CSRF state store: state -> expiry timestamp
const pendingStates = new Map();
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanExpiredStates() {
  const now = Date.now();
  for (const [s, exp] of pendingStates) {
    if (now > exp) pendingStates.delete(s);
  }
}

// GET /auth/github — redirect to GitHub OAuth
router.get('/github', (req, res) => {
  cleanExpiredStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  res.redirect(getAuthUrl(state));
});

// GET /auth/callback — GitHub OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  if (!state || !pendingStates.has(state) || Date.now() > pendingStates.get(state)) {
    return res.status(403).json({ error: 'Invalid or expired OAuth state' });
  }
  pendingStates.delete(state);

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
router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    login: req.user.github_login,
    name: req.user.name,
    avatar_url: req.user.avatar_url,
  });
});

export default router;
