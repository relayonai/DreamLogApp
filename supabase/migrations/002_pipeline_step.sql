ALTER TABLE dreams ADD COLUMN pipeline_step text;
ALTER TABLE dreams ADD COLUMN failed_reason text;
ALTER TABLE dreams DROP CONSTRAINT dreams_status_check;
ALTER TABLE dreams ADD CONSTRAINT dreams_status_check
  CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'pending_sync'));
