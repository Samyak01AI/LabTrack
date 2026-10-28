import crypto from 'node:crypto';

export function createGradeRepository(pool) {
  function toGrade(row) {
    if (!row) return null;
    return {
      id: row.id,
      submissionId: row.submission_id,
      assignmentId: row.assignment_id,
      studentId: row.student_id,
      teacherId: row.teacher_id,
      correctnessScore: Number(row.correctness_score),
      logicScore: Number(row.logic_score),
      complexityScore: Number(row.complexity_score),
      transparencyScore: Number(row.transparency_score),
      totalScore: Number(row.total_score),
      maxScore: Number(row.max_score),
      status: row.status,
      rubricScores: typeof row.rubric_scores === 'string' ? JSON.parse(row.rubric_scores) : row.rubric_scores || null,
      feedback: row.feedback || null,
      reopenReason: row.reopen_reason || null,
      finalisedAt: row.finalised_at ? new Date(row.finalised_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      studentName: row.student_name || null,
      studentEmail: row.student_email || null,
    };
  }

  return {
    async listQueueByAssignment(assignmentId) {
      const query = `
        SELECT
          s.id AS submission_id,
          s.assignment_id,
          s.student_id,
          s.language,
          s.status AS submission_status,
          s.results,
          s.annotation_status,
          s.submitted_at,
          u.display_name AS student_name,
          u.email AS student_email,
          g.id AS id,
          g.teacher_id,
          COALESCE(g.correctness_score, 0) AS correctness_score,
          COALESCE(g.logic_score, 0) AS logic_score,
          COALESCE(g.complexity_score, 0) AS complexity_score,
          COALESCE(g.transparency_score, 0) AS transparency_score,
          COALESCE(g.total_score, 0) AS total_score,
          COALESCE(g.max_score, 100) AS max_score,
          COALESCE(g.status, 'pending_review') AS status,
          g.rubric_scores,
          g.feedback,
          g.reopen_reason,
          g.finalised_at,
          g.created_at,
          g.updated_at
        FROM submissions s
        INNER JOIN users u ON u.id = s.student_id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE s.assignment_id = ? AND s.is_final = 1
        ORDER BY s.submitted_at DESC
      `;
      const [rows] = await pool.query(query, [assignmentId]);

      // Deduplicate by studentId, keeping the latest final submission per student
      const seenStudents = new Set();
      const queue = [];
      for (const row of rows) {
        if (!seenStudents.has(row.student_id)) {
          seenStudents.add(row.student_id);
          queue.push({
            ...toGrade(row),
            submissionId: row.submission_id,
            language: row.language,
            submissionStatus: row.submission_status,
            results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results || [],
            annotationStatus: row.annotation_status,
            submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
          });
        }
      }
      return queue;
    },

    async getGradeBySubmission(submissionId) {
      const query = `
        SELECT
          g.*,
          u.display_name AS student_name,
          u.email AS student_email
        FROM grades g
        INNER JOIN users u ON u.id = g.student_id
        WHERE g.submission_id = ?
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [submissionId]);
      return rows.length > 0 ? toGrade(rows[0]) : null;
    },

    async getGradeById(id) {
      const query = `
        SELECT
          g.*,
          u.display_name AS student_name,
          u.email AS student_email
        FROM grades g
        INNER JOIN users u ON u.id = g.student_id
        WHERE g.id = ?
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [id]);
      return rows.length > 0 ? toGrade(rows[0]) : null;
    },

    async getGradeByStudentAssignment(studentId, assignmentId) {
      const query = `
        SELECT
          g.*,
          u.display_name AS student_name,
          u.email AS student_email
        FROM grades g
        INNER JOIN users u ON u.id = g.student_id
        WHERE g.student_id = ? AND g.assignment_id = ?
        ORDER BY g.updated_at DESC
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [studentId, assignmentId]);
      return rows.length > 0 ? toGrade(rows[0]) : null;
    },

    async upsertGrade({
      id = crypto.randomUUID(),
      submissionId,
      assignmentId,
      studentId,
      teacherId,
      correctnessScore,
      logicScore,
      complexityScore,
      transparencyScore,
      totalScore,
      maxScore = 100,
      status = 'provisionally_scored',
      rubricScores = null,
      feedback = null,
    }) {
      const isFinalised = status === 'finalised';

      const query = `
        INSERT INTO grades (
          id, submission_id, assignment_id, student_id, teacher_id,
          correctness_score, logic_score, complexity_score, transparency_score,
          total_score, max_score, status, rubric_scores, feedback,
          finalised_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          teacher_id = VALUES(teacher_id),
          correctness_score = VALUES(correctness_score),
          logic_score = VALUES(logic_score),
          complexity_score = VALUES(complexity_score),
          transparency_score = VALUES(transparency_score),
          total_score = VALUES(total_score),
          max_score = VALUES(max_score),
          status = VALUES(status),
          rubric_scores = VALUES(rubric_scores),
          feedback = VALUES(feedback),
          finalised_at = IF(VALUES(status) = 'finalised', CURRENT_TIMESTAMP(3), finalised_at),
          updated_at = CURRENT_TIMESTAMP(3)
      `;

      await pool.query(query, [
        id,
        submissionId,
        assignmentId,
        studentId,
        teacherId,
        correctnessScore,
        logicScore,
        complexityScore,
        transparencyScore,
        totalScore,
        maxScore,
        status,
        rubricScores ? JSON.stringify(rubricScores) : null,
        feedback,
        isFinalised ? new Date() : null,
      ]);

      return this.getGradeBySubmission(submissionId);
    },

    async reopenGrade(gradeId, teacherId, reason) {
      const query = `
        UPDATE grades SET
          status = 'reopened',
          reopen_reason = ?,
          finalised_at = NULL,
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `;
      await pool.query(query, [reason, gradeId]);
      return this.getGradeById(gradeId);
    },
  };
}

