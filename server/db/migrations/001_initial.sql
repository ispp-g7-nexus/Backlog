-- NexUS Backlog: Initial schema
-- Run: psql -d nexus_backlog -f server/db/migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users (GitHub OAuth)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id     INTEGER UNIQUE NOT NULL,
  github_login  VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(255),
  avatar_url    TEXT,
  github_token  TEXT,  -- encrypted
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Projects linked to a GitHub repo + GitHub Project
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_org      VARCHAR(100) NOT NULL,
  github_repo     VARCHAR(100) NOT NULL,
  project_number  INTEGER NOT NULL,
  name            VARCHAR(255) NOT NULL,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(github_org, github_repo, project_number)
);

-- Project users (multi-user access)
CREATE TABLE project_users (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  PRIMARY KEY (project_id, user_id)
);

-- Team members (mapping GitHub login <-> display name <-> email <-> Clockify)
CREATE TABLE project_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  github_login    VARCHAR(100),
  display_name    VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  clockify_name   VARCHAR(255),
  role            VARCHAR(20) DEFAULT 'dev' CHECK (role IN ('sm','po','dev','coord')),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_members_project ON project_members(project_id);

-- Teams / groups (customizable)
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) DEFAULT '#6366f1'
);

CREATE TABLE team_members (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES project_members(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, member_id)
);

-- Sprints (configurable)
CREATE TABLE sprints (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  label       VARCHAR(100) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  weight_pct  NUMERIC(5,2) DEFAULT 0,
  UNIQUE(project_id, number)
);

-- Custom labels by category
CREATE TABLE custom_labels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    VARCHAR(50) NOT NULL,  -- 'equipo', 'tipo', 'area', etc.
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) DEFAULT '#71717a'
);

-- Clockify tag <-> task ID mappings
CREATE TABLE clockify_mappings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clockify_tag VARCHAR(255) NOT NULL,
  task_id      VARCHAR(50) NOT NULL,
  mapped_by    VARCHAR(10) DEFAULT 'auto' CHECK (mapped_by IN ('auto','manual'))
);

-- Saved views
CREATE TABLE saved_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}'
);

-- Retrospective boards
CREATE TABLE retro_boards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id   UUID REFERENCES sprints(id) ON DELETE SET NULL,
  items       JSONB DEFAULT '[]',
  votes       JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Metric formulas (customizable calculations)
CREATE TABLE metric_formulas (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key         VARCHAR(50) NOT NULL,
  formula     TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (project_id, key)
);

-- Cost profiles
CREATE TABLE cost_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  multiplier  NUMERIC(5,2) DEFAULT 1.00,
  hourly_rate NUMERIC(8,2) NOT NULL,
  headcount   INTEGER DEFAULT 1
);

-- Cost config (project-level)
CREATE TABLE cost_config (
  project_id    UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  hbs_rate      NUMERIC(8,2) DEFAULT 25.50,
  gg_pct        NUMERIC(5,2) DEFAULT 13.00,
  bi_pct        NUMERIC(5,2) DEFAULT 6.00,
  iva_pct       NUMERIC(5,2) DEFAULT 21.00,
  budget_total  NUMERIC(12,2) DEFAULT 0
);

-- Risk thresholds
CREATE TABLE risk_thresholds (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key         VARCHAR(50) NOT NULL,
  value       NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (project_id, key)
);

-- Activity log (who changed what, when)
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     VARCHAR(50),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  field       VARCHAR(100) NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activity_project ON activity_log(project_id, created_at DESC);
CREATE INDEX idx_activity_task ON activity_log(task_id, created_at DESC);
