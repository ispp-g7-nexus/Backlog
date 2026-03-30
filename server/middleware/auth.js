import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { decrypt } from '../lib/encrypt.js';

const JWT_SECRET = () => process.env.JWT_SECRET || 'nexus-dev-secret-change-me';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET());
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyToken(header.slice(7));
    const result = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });

    req.user = result.rows[0];
    req.githubToken = req.user.github_token ? decrypt(req.user.github_token) : null;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Use as: router.param('projectId', requireProjectAccess)
export async function requireProjectAccess(req, res, next, projectId) {
  try {
    const result = await query(
      'SELECT role FROM project_users WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    if (!result.rows[0]) return res.status(403).json({ error: 'Access denied' });
    req.projectRole = result.rows[0].role;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify project access' });
  }
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const decoded = verifyToken(header.slice(7));
    const result = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows[0]) {
      req.user = result.rows[0];
      req.githubToken = req.user.github_token ? decrypt(req.user.github_token) : null;
    }
  } catch { /* ignore */ }
  next();
}
