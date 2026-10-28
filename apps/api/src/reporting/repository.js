export function createReportingRepository(pool) {
  function parseJson(val) {
    if (val == null) return null;
    return typeof val === 'string' ? JSON.parse(val) : val;
  }

  return {
    async getStudentSubmissionHistory(studentId, assignmentId = null) {
      let query = `
        SELECT
          s.id AS submission_id,
          s.assignment_id,
          s.student_id,
          s.language,
          s.source_code,
          s.status AS execution_status,
          s.results,
          s.execution_time_ms,
          s.memory_kb,
          s.compiler_output,
          s.ai_declaration,
          s.logic_explanation,
          s.annotations,
          s.annotation_status,
          s.is_final,
          s.submitted_at,
          s.created_at,
          a.assignment_code,
          a.title AS assignment_title,
          a.course_code,
          a.max_score,
          g.id AS grade_id,
          g.correctness_score,
          g.logic_score,
          g.complexity_score,
          g.transparency_score,
          g.total_score,
          g.status AS grade_status,
          g.feedback,
          g.finalised_at
        FROM submissions s
        INNER JOIN assignments a ON a.id = s.assignment_id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE s.student_id = ?
      `;
      const params = [studentId];

      if (assignmentId) {
        query += ' AND s.assignment_id = ?';
        params.push(assignmentId);
      }

      query += ' ORDER BY s.created_at DESC';

      const [rows] = await pool.query(query, params);
      return rows.map((r) => {
        const results = parseJson(r.results) || [];
        const passedTests = results.filter((t) => t.status === 'PASS').length;
        const totalTests = results.length;
        const aiDecl = parseJson(r.ai_declaration);
        const annots = parseJson(r.annotations) || [];

        return {
          submissionId: r.submission_id,
          assignmentId: r.assignment_id,
          assignmentCode: r.assignment_code,
          assignmentTitle: r.assignment_title,
          courseCode: r.course_code,
          maxScore: Number(r.max_score) || 100,
          language: r.language,
          sourceCode: r.source_code,
          executionStatus: r.execution_status,
          executionTimeMs: r.execution_time_ms,
          memoryKb: r.memory_kb,
          compilerOutput: r.compiler_output,
          results,
          passedTests,
          totalTests,
          isFinal: Boolean(r.is_final),
          submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
          createdAt: new Date(r.created_at).toISOString(),
          aiDeclaration: aiDecl,
          aiDeclared: Boolean(aiDecl?.aiUsed),
          aiTools: aiDecl?.tools || [],
          annotationStatus: r.annotation_status,
          annotationsCount: annots.length,
          logicExplanation: parseJson(r.logic_explanation),
          grade: r.grade_id
            ? {
                id: r.grade_id,
                correctnessScore: Number(r.correctness_score),
                logicScore: Number(r.logic_score),
                complexityScore: Number(r.complexity_score),
                transparencyScore: Number(r.transparency_score),
                totalScore: Number(r.total_score),
                status: r.grade_status,
                feedback: r.feedback,
                finalisedAt: r.finalised_at ? new Date(r.finalised_at).toISOString() : null,
              }
            : null,
        };
      });
    },

    async getCohortResults(assignmentId) {
      const query = `
        SELECT
          s.id AS submission_id,
          s.assignment_id,
          s.student_id,
          s.language,
          s.results,
          s.ai_declaration,
          s.annotations,
          s.annotation_status,
          s.submitted_at,
          u.display_name AS student_name,
          u.email AS student_email,
          g.id AS grade_id,
          COALESCE(g.correctness_score, 0) AS correctness_score,
          COALESCE(g.logic_score, 0) AS logic_score,
          COALESCE(g.complexity_score, 0) AS complexity_score,
          COALESCE(g.transparency_score, 0) AS transparency_score,
          COALESCE(g.total_score, 0) AS total_score,
          COALESCE(g.status, 'pending_review') AS grade_status,
          g.feedback,
          g.finalised_at
        FROM submissions s
        INNER JOIN users u ON u.id = s.student_id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE s.assignment_id = ? AND s.is_final = 1
        ORDER BY s.submitted_at DESC
      `;
      const [rows] = await pool.query(query, [assignmentId]);

      // Deduplicate by studentId, keeping latest final submission
      const studentLatest = new Map();
      for (const r of rows) {
        if (!studentLatest.has(r.student_id)) {
          studentLatest.set(r.student_id, r);
        }
      }

      // Fetch similarity reports for this assignment to associate flags
      const [simRows] = await pool.query(
        'SELECT submission_a_id, submission_b_id, similarity_score, status FROM similarity_reports WHERE assignment_id = ?',
        [assignmentId],
      );

      const simMap = new Map();
      for (const sr of simRows) {
        const score = Number(sr.similarity_score);
        const isFlagged = sr.status === 'flagged' || score >= 75;
        // Map to submission A
        if (!simMap.has(sr.submission_a_id) || simMap.get(sr.submission_a_id).score < score) {
          simMap.set(sr.submission_a_id, { score, isFlagged });
        }
        // Map to submission B
        if (!simMap.has(sr.submission_b_id) || simMap.get(sr.submission_b_id).score < score) {
          simMap.set(sr.submission_b_id, { score, isFlagged });
        }
      }

      const cohort = [];
      for (const r of studentLatest.values()) {
        const aiDecl = parseJson(r.ai_declaration);
        const results = parseJson(r.results) || [];
        const passedTests = results.filter((t) => t.status === 'PASS').length;
        const sim = simMap.get(r.submission_id);

        cohort.push({
          submissionId: r.submission_id,
          studentId: r.student_id,
          studentName: r.student_name,
          studentEmail: r.student_email,
          language: r.language,
          submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
          passedTests,
          totalTests: results.length,
          aiDeclared: Boolean(aiDecl?.aiUsed),
          aiTools: aiDecl?.tools || [],
          annotationStatus: r.annotation_status,
          correctnessScore: Number(r.correctness_score),
          logicScore: Number(r.logic_score),
          complexityScore: Number(r.complexity_score),
          transparencyScore: Number(r.transparency_score),
          totalScore: Number(r.total_score),
          gradeStatus: r.grade_status,
          feedback: r.feedback,
          finalisedAt: r.finalised_at ? new Date(r.finalised_at).toISOString() : null,
          similarityScore: sim ? sim.score : null,
          isFlagged: sim ? sim.isFlagged : false,
          grade: r.grade_id
            ? {
                id: r.grade_id,
                correctnessScore: Number(r.correctness_score),
                logicScore: Number(r.logic_score),
                complexityScore: Number(r.complexity_score),
                transparencyScore: Number(r.transparency_score),
                totalScore: Number(r.total_score),
                status: r.grade_status,
                feedback: r.feedback,
                finalisedAt: r.finalised_at ? new Date(r.finalised_at).toISOString() : null,
              }
            : null,
        });
      }

      // Sort descending by totalScore
      cohort.sort((a, b) => b.totalScore - a.totalScore);
      return cohort;
    },
  };
}
