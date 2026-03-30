-- Add sprint_number to retro_boards for numeric sprint lookup
ALTER TABLE retro_boards ADD COLUMN IF NOT EXISTS sprint_number INTEGER;
ALTER TABLE retro_boards ALTER COLUMN sprint_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_retro_project_sprint
  ON retro_boards(project_id, sprint_number)
  WHERE sprint_number IS NOT NULL;
