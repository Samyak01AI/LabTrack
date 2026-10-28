-- Migration 007: AI Assistance Audit Logs
-- Tracks in-platform generative AI queries, pedagogical guidance responses, and session attribution.

CREATE TABLE IF NOT EXISTS ai_assistance_logs (
  id CHAR(36) NOT NULL,
  assignment_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  code_snippet TEXT NULL,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ai_logs_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_logs_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_ai_mode CHECK (mode IN ('hint', 'debug', 'complexity'))
);

CREATE INDEX idx_ai_logs_rate_limit ON ai_assistance_logs (student_id, assignment_id, created_at);
