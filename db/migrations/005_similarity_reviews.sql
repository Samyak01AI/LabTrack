CREATE TABLE IF NOT EXISTS similarity_reports (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  assignment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  submission_a_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  submission_b_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  similarity_score DECIMAL(5,2) NOT NULL,
  token_similarity DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ast_isomorphism DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  matched_segments JSON NOT NULL,
  metrics JSON DEFAULT NULL,
  threshold_used INT NOT NULL DEFAULT 75,
  status VARCHAR(24) NOT NULL DEFAULT 'flagged',
  teacher_notes TEXT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT similarity_reports_assignment_fk FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  CONSTRAINT similarity_reports_sub_a_fk FOREIGN KEY (submission_a_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT similarity_reports_sub_b_fk FOREIGN KEY (submission_b_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT similarity_reports_status_valid CHECK (status IN ('flagged', 'reviewed', 'dismissed')),
  UNIQUE KEY uq_similarity_pair (assignment_id, submission_a_id, submission_b_id),
  KEY similarity_reports_assignment_status_idx (assignment_id, status, similarity_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

