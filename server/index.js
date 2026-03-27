import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import projectRoutes from './routes/projects.js';
import memberRoutes from './routes/members.js';
import teamRoutes from './routes/teams.js';
import sprintRoutes from './routes/sprints.js';
import githubProxyRoutes from './routes/github-proxy.js';
import configRoutes from './routes/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Auth routes (no auth middleware — OAuth flow)
app.use('/auth', authRoutes);

// Protected API routes
app.use('/api/user', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', memberRoutes);   // /api/projects/:projectId/members
app.use('/api/projects', teamRoutes);     // /api/projects/:projectId/teams
app.use('/api/projects', sprintRoutes);   // /api/projects/:projectId/sprints
app.use('/api/projects', configRoutes);   // /api/projects/:projectId/labels|metrics|costs|risks|views
app.use('/api/github', githubProxyRoutes);

// Auth middleware for /auth/me
app.get('/auth/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    login: req.user.github_login,
    name: req.user.name,
    avatar_url: req.user.avatar_url,
  });
});

// Serve static frontend (dist/)
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Server] Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[NexUS] Server running on http://localhost:${PORT}`);
});
