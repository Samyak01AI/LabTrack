import { randomUUID } from 'node:crypto';

export function createAiRepository(pool) {
  return {
    /**
     * Logs an AI assistance interaction.
     */
    async logInteraction({
      assignmentId,
      studentId,
      mode,
      prompt,
      response,
      codeSnippet = null,
      tokensUsed = 0,
    }) {
      const id = randomUUID();
      const query = `
        INSERT INTO ai_assistance_logs (
          id, assignment_id, student_id, mode, prompt, response, code_snippet, tokens_used, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      await pool.query(query, [
        id,
        assignmentId,
        studentId,
        mode,
        prompt,
        response,
        codeSnippet ? codeSnippet.slice(0, 5000) : null,
        tokensUsed,
      ]);

      return {
        id,
        assignmentId,
        studentId,
        mode,
        prompt,
        response,
        tokensUsed,
        createdAt: new Date().toISOString(),
      };
    },

    /**
     * Counts interactions for a student on an assignment within the past 1 hour.
     */
    async getRecentHourlyCount(studentId, assignmentId) {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      const query = `
        SELECT COUNT(*) AS total
        FROM ai_assistance_logs
        WHERE student_id = ? AND assignment_id = ? AND created_at >= ?
      `;
      const [rows] = await pool.query(query, [studentId, assignmentId, oneHourAgo]);
      return Number(rows[0]?.total || 0);
    },

    /**
     * Retrieves all AI logs for a student on a specific assignment.
     */
    async getStudentLogs(studentId, assignmentId) {
      const query = `
        SELECT
          id,
          assignment_id,
          student_id,
          mode,
          prompt,
          response,
          code_snippet,
          tokens_used,
          created_at
        FROM ai_assistance_logs
        WHERE student_id = ? AND assignment_id = ?
        ORDER BY created_at ASC
      `;
      const [rows] = await pool.query(query, [studentId, assignmentId]);
      return rows.map((r) => ({
        id: r.id,
        assignmentId: r.assignment_id,
        studentId: r.student_id,
        mode: r.mode,
        prompt: r.prompt,
        response: r.response,
        codeSnippet: r.code_snippet,
        tokensUsed: r.tokens_used,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    },

    /**
     * Retrieves AI logs associated with a student and assignment for teacher inspection.
     */
    async getTeacherAuditLogs(studentId, assignmentId) {
      const query = `
        SELECT
          id,
          assignment_id,
          student_id,
          mode,
          prompt,
          response,
          code_snippet,
          tokens_used,
          created_at
        FROM ai_assistance_logs
        WHERE student_id = ? AND assignment_id = ?
        ORDER BY created_at ASC
      `;
      const [rows] = await pool.query(query, [studentId, assignmentId]);
      return rows.map((r) => ({
        id: r.id,
        assignmentId: r.assignment_id,
        studentId: r.student_id,
        mode: r.mode,
        prompt: r.prompt,
        response: r.response,
        codeSnippet: r.code_snippet,
        tokensUsed: r.tokens_used,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    },
  };
}

