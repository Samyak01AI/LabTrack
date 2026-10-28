import crypto from 'node:crypto';

export function createSimilarityRepository(pool) {
  return {
    async listByAssignment(assignmentId, { threshold = 0, status = 'all' } = {}) {
      let query = `
        SELECT
          sr.id,
          sr.assignment_id AS assignmentId,
          sr.submission_a_id AS submissionAId,
          sr.submission_b_id AS submissionBId,
          sr.similarity_score AS similarityScore,
          sr.token_similarity AS tokenSimilarity,
          sr.ast_isomorphism AS astIsomorphism,
          sr.matched_segments AS matchedSegments,
          sr.metrics,
          sr.threshold_used AS thresholdUsed,
          sr.status,
          sr.teacher_notes AS teacherNotes,
          sr.created_at AS createdAt,
          sr.updated_at AS updatedAt,
          ua.display_name AS studentAName,
          ua.email AS studentAEmail,
          ub.display_name AS studentBName,
          ub.email AS studentBEmail,
          sa.language AS languageA,
          sb.language AS languageB
        FROM similarity_reports sr
        INNER JOIN submissions sa ON sa.id = sr.submission_a_id
        INNER JOIN users ua ON ua.id = sa.student_id
        INNER JOIN submissions sb ON sb.id = sr.submission_b_id
        INNER JOIN users ub ON ub.id = sb.student_id
        WHERE sr.assignment_id = ?
      `;
      const params = [assignmentId];

      if (threshold > 0) {
        query += ' AND sr.similarity_score >= ?';
        params.push(threshold);
      }

      if (status && status !== 'all') {
        query += ' AND sr.status = ?';
        params.push(status);
      }

      query += ' ORDER BY sr.similarity_score DESC, sr.created_at DESC';

      const [rows] = await pool.query(query, params);
      return rows.map((r) => ({
        ...r,
        similarityScore: Number(r.similarityScore),
        tokenSimilarity: Number(r.tokenSimilarity),
        astIsomorphism: Number(r.astIsomorphism),
        matchedSegments: typeof r.matchedSegments === 'string' ? JSON.parse(r.matchedSegments) : r.matchedSegments || [],
        metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics || {},
      }));
    },

    async getById(id) {
      const query = `
        SELECT
          sr.id,
          sr.assignment_id AS assignmentId,
          sr.submission_a_id AS submissionAId,
          sr.submission_b_id AS submissionBId,
          sr.similarity_score AS similarityScore,
          sr.token_similarity AS tokenSimilarity,
          sr.ast_isomorphism AS astIsomorphism,
          sr.matched_segments AS matchedSegments,
          sr.metrics,
          sr.threshold_used AS thresholdUsed,
          sr.status,
          sr.teacher_notes AS teacherNotes,
          sr.created_at AS createdAt,
          sr.updated_at AS updatedAt,
          sa.source_code AS sourceCodeA,
          sa.language AS languageA,
          sa.submitted_at AS submittedAtA,
          sa.ai_declaration AS aiDeclarationA,
          sa.logic_explanation AS logicExplanationA,
          sa.annotations AS annotationsA,
          sa.annotation_status AS annotationStatusA,
          ua.id AS studentAId,
          ua.display_name AS studentAName,
          ua.email AS studentAEmail,
          sb.source_code AS sourceCodeB,
          sb.language AS languageB,
          sb.submitted_at AS submittedAtB,
          sb.ai_declaration AS aiDeclarationB,
          sb.logic_explanation AS logicExplanationB,
          sb.annotations AS annotationsB,
          sb.annotation_status AS annotationStatusB,
          ub.id AS studentBId,
          ub.display_name AS studentBName,
          ub.email AS studentBEmail
        FROM similarity_reports sr
        INNER JOIN submissions sa ON sa.id = sr.submission_a_id
        INNER JOIN users ua ON ua.id = sa.student_id
        INNER JOIN submissions sb ON sb.id = sr.submission_b_id
        INNER JOIN users ub ON ub.id = sb.student_id
        WHERE sr.id = ?
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [id]);
      if (rows.length === 0) return null;
      const r = rows[0];

      return {
        id: r.id,
        assignmentId: r.assignmentId,
        submissionAId: r.submissionAId,
        submissionBId: r.submissionBId,
        similarityScore: Number(r.similarityScore),
        tokenSimilarity: Number(r.tokenSimilarity),
        astIsomorphism: Number(r.astIsomorphism),
        matchedSegments: typeof r.matchedSegments === 'string' ? JSON.parse(r.matchedSegments) : r.matchedSegments || [],
        metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics || {},
        thresholdUsed: r.thresholdUsed,
        status: r.status,
        teacherNotes: r.teacherNotes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        student1: {
          id: r.studentAId,
          name: r.studentAName,
          email: r.studentAEmail,
          sourceCode: r.sourceCodeA,
          language: r.languageA,
          submittedAt: r.submittedAtA,
          aiDeclaration: typeof r.aiDeclarationA === 'string' ? JSON.parse(r.aiDeclarationA) : r.aiDeclarationA,
          logicExplanation: typeof r.logicExplanationA === 'string' ? JSON.parse(r.logicExplanationA) : r.logicExplanationA,
          annotations: typeof r.annotationsA === 'string' ? JSON.parse(r.annotationsA) : r.annotationsA,
          annotationStatus: r.annotationStatusA,
        },
        student2: {
          id: r.studentBId,
          name: r.studentBName,
          email: r.studentBEmail,
          sourceCode: r.sourceCodeB,
          language: r.languageB,
          submittedAt: r.submittedAtB,
          aiDeclaration: typeof r.aiDeclarationB === 'string' ? JSON.parse(r.aiDeclarationB) : r.aiDeclarationB,
          logicExplanation: typeof r.logicExplanationB === 'string' ? JSON.parse(r.logicExplanationB) : r.logicExplanationB,
          annotations: typeof r.annotationsB === 'string' ? JSON.parse(r.annotationsB) : r.annotationsB,
          annotationStatus: r.annotationStatusB,
        },
      };
    },

    async upsertReport({
      id = crypto.randomUUID(),
      assignmentId,
      submissionAId,
      submissionBId,
      similarityScore,
      tokenSimilarity = 0,
      astIsomorphism = 0,
      matchedSegments = [],
      metrics = null,
      thresholdUsed = 75,
      status = 'flagged',
      teacherNotes = null,
    }) {
      // Ensure deterministic ordering of subA and subB to avoid duplicate inverted pairs
      let firstId = submissionAId;
      let secondId = submissionBId;
      if (firstId > secondId) {
        firstId = submissionBId;
        secondId = submissionAId;
      }

      const query = `
        INSERT INTO similarity_reports (
          id, assignment_id, submission_a_id, submission_b_id,
          similarity_score, token_similarity, ast_isomorphism,
          matched_segments, metrics, threshold_used, status, teacher_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          similarity_score = VALUES(similarity_score),
          token_similarity = VALUES(token_similarity),
          ast_isomorphism = VALUES(ast_isomorphism),
          matched_segments = VALUES(matched_segments),
          metrics = VALUES(metrics),
          threshold_used = VALUES(threshold_used),
          status = VALUES(status),
          updated_at = CURRENT_TIMESTAMP(3)
      `;

      await pool.query(query, [
        id,
        assignmentId,
        firstId,
        secondId,
        similarityScore,
        tokenSimilarity,
        astIsomorphism,
        JSON.stringify(matchedSegments),
        JSON.stringify(metrics),
        thresholdUsed,
        status,
        teacherNotes,
      ]);

      return this.getById(id);
    },

    async updateReport(id, { status, teacherNotes }) {
      const updates = [];
      const params = [];

      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (teacherNotes !== undefined) {
        updates.push('teacher_notes = ?');
        params.push(teacherNotes);
      }

      if (updates.length === 0) return this.getById(id);

      params.push(id);
      await pool.query(
        `UPDATE similarity_reports SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        params
      );

      return this.getById(id);
    },

    async deleteByAssignment(assignmentId) {
      await pool.query('DELETE FROM similarity_reports WHERE assignment_id = ?', [assignmentId]);
    },
  };
}
