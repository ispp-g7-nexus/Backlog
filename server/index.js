import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/pool.js';
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

// Simple in-memory rate limiter
function createRateLimiter(windowMs, max, message) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const key = req.ip;
    const count = (hits.get(key) || 0) + 1;
    hits.set(key, count);
    if (count > max) return res.status(429).json({ error: message });
    next();
  };
}
const apiLimiter  = createRateLimiter(60_000, 100, 'Too many requests');
const authLimiter = createRateLimiter(60_000, 10, 'Too many auth requests');

// Health check (no auth)
const startTime = Date.now();
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: Math.floor((Date.now() - startTime) / 1000) }));

// Auth routes (no auth middleware — OAuth flow)
app.use('/auth', authLimiter, authRoutes);

// Protected API routes
app.use('/api', apiLimiter);
app.use('/api/user', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', memberRoutes);   // /api/projects/:projectId/members
app.use('/api/projects', teamRoutes);     // /api/projects/:projectId/teams
app.use('/api/projects', sprintRoutes);   // /api/projects/:projectId/sprints
app.use('/api/projects', configRoutes);      // /api/projects/:projectId/labels|metrics|costs|risks|views
app.use('/api/projects', githubProxyRoutes); // /api/projects/:projectId/github/*

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

const server = app.listen(PORT, () => {
  console.log(`[NexUS] Server running on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`[NexUS] ${signal} received, shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
