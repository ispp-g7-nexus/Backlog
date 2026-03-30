-- Performance indexes for foreign keys and frequent lookups

CREATE INDEX IF NOT EXISTS idx_teams_project ON teams(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_labels_project ON custom_labels(project_id);
CREATE INDEX IF NOT EXISTS idx_views_project ON saved_views(project_id);
CREATE INDEX IF NOT EXISTS idx_clockify_project ON clockify_mappings(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_profiles_project ON cost_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_retro_project ON retro_boards(project_id);
CREATE INDEX IF NOT EXISTS idx_pu_user ON project_users(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
