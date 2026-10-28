ALTER TABLE submissions
  ADD COLUMN ai_declaration JSON DEFAULT NULL,
  ADD COLUMN logic_explanation JSON DEFAULT NULL,
  ADD COLUMN annotations JSON DEFAULT NULL,
  ADD COLUMN annotation_status VARCHAR(24) NOT NULL DEFAULT 'not_required',
  ADD COLUMN is_final TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN submitted_at DATETIME(3) DEFAULT NULL;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_annotation_status_valid
  CHECK (annotation_status IN ('not_required', 'complete', 'incomplete'));

