import { randomUUID } from 'node:crypto';

const COLUMNS = `id, assignment_id, student_id, language, source_code, status,
  results, execution_time_ms, memory_kb, compiler_output,
  ai_declaration, logic_explanation, annotations, annotation_status,
  is_final, submitted_at, created_at, updated_at`;

function parseJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function toIsoUtc(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') throw new TypeError('Database datetime value is not a string or Date.');
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new TypeError('Database returned an invalid datetime value.');
  return date.toISOString();
}

function toSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    language: row.language,
    sourceCode: row.source_code,
    status: row.status,
    results: parseJson(row.results),
    executionTimeMs: row.execution_time_ms ?? null,
    memoryKb: row.memory_kb ?? null,
    compilerOutput: row.compiler_output ?? null,
    aiDeclaration: parseJson(row.ai_declaration),
    logicExplanation: parseJson(row.logic_explanation),
    annotations: parseJson(row.annotations) ?? [],
    annotationStatus: row.annotation_status ?? 'not_required',
    isFinal: Boolean(row.is_final),
    submittedAt: row.submitted_at ? toIsoUtc(row.submitted_at) : null,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export function createSubmissionRepository(pool) {
  async function findOne(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return toSubmission(rows[0]);
  }

  return {
    async create({
      assignmentId,
      studentId,
      language,
      sourceCode,
      status = 'pending',
      aiDeclaration = null,
      logicExplanation = null,
      annotations = null,
      annotationStatus = 'not_required',
      isFinal = false,
      submittedAt = null,
    }) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO submissions (
           id, assignment_id, student_id, language, source_code, status,
           ai_declaration, logic_explanation, annotations, annotation_status,
           is_final, submitted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          assignmentId,
          studentId,
          language,
          sourceCode,
          status,
          aiDeclaration ? JSON.stringify(aiDeclaration) : null,
          logicExplanation ? JSON.stringify(logicExplanation) : null,
          annotations ? JSON.stringify(annotations) : null,
          annotationStatus,
          isFinal ? 1 : 0,
          submittedAt ? new Date(submittedAt) : (isFinal ? new Date() : null),
        ],
      );
      return findOne(`SELECT ${COLUMNS} FROM submissions WHERE id = ? LIMIT 1`, [id]);
    },

    async saveDraft({
      assignmentId,
      studentId,
      language,
      sourceCode,
      aiDeclaration = null,
      logicExplanation = null,
      annotations = null,
      annotationStatus = 'not_required',
    }) {
      const [rows] = await pool.execute(
        'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ? AND is_final = 0 ORDER BY created_at DESC LIMIT 1',
        [assignmentId, studentId],
      );
      if (rows.length > 0) {
        const draftId = rows[0].id;
        await pool.execute(
          `UPDATE submissions SET
             language = ?, source_code = ?,
             ai_declaration = ?, logic_explanation = ?, annotations = ?,
             annotation_status = ?, updated_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND is_final = 0`,
          [
            language,
            sourceCode,
            aiDeclaration ? JSON.stringify(aiDeclaration) : null,
            logicExplanation ? JSON.stringify(logicExplanation) : null,
            annotations ? JSON.stringify(annotations) : null,
            annotationStatus,
            draftId,
          ],
        );
        return findOne(`SELECT ${COLUMNS} FROM submissions WHERE id = ? LIMIT 1`, [draftId]);
      }

      const id = randomUUID();
      await pool.execute(
        `INSERT INTO submissions (
           id, assignment_id, student_id, language, source_code, status,
           ai_declaration, logic_explanation, annotations, annotation_status,
           is_final, submitted_at
         ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0, NULL)`,
        [
          id,
          assignmentId,
          studentId,
          language,
          sourceCode,
          aiDeclaration ? JSON.stringify(aiDeclaration) : null,
          logicExplanation ? JSON.stringify(logicExplanation) : null,
          annotations ? JSON.stringify(annotations) : null,
          annotationStatus,
        ],
      );
      return findOne(`SELECT ${COLUMNS} FROM submissions WHERE id = ? LIMIT 1`, [id]);
    },

    async getById(id) {
      return findOne(`SELECT ${COLUMNS} FROM submissions WHERE id = ? LIMIT 1`, [id]);
    },

    async getByIdForStudent(id, studentId) {
      return findOne(
        `SELECT ${COLUMNS} FROM submissions WHERE id = ? AND student_id = ? LIMIT 1`,
        [id, studentId],
      );
    },

    async getLatestByStudentForAssignment(studentId, assignmentId) {
      return findOne(
        `SELECT ${COLUMNS} FROM submissions
         WHERE student_id = ? AND assignment_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [studentId, assignmentId],
      );
    },

    async getLatestDraft(studentId, assignmentId) {
      return findOne(
        `SELECT ${COLUMNS} FROM submissions
         WHERE student_id = ? AND assignment_id = ? AND is_final = 0
         ORDER BY created_at DESC LIMIT 1`,
        [studentId, assignmentId],
      );
    },

    async listByStudentForAssignment(studentId, assignmentId) {
      const [rows] = await pool.execute(
        `SELECT ${COLUMNS} FROM submissions
         WHERE student_id = ? AND assignment_id = ?
         ORDER BY created_at DESC LIMIT 50`,
        [studentId, assignmentId],
      );
      return rows.map(toSubmission);
    },

    async listFinalByStudentForAssignment(studentId, assignmentId) {
      const [rows] = await pool.execute(
        `SELECT ${COLUMNS} FROM submissions
         WHERE student_id = ? AND assignment_id = ? AND is_final = 1
         ORDER BY submitted_at DESC LIMIT 50`,
        [studentId, assignmentId],
      );
      return rows.map(toSubmission);
    },

    async listByAssignment(assignmentId) {
      const [rows] = await pool.execute(
        `SELECT s.id, s.assignment_id, s.student_id, s.language, s.source_code, s.status,
                s.results, s.execution_time_ms, s.memory_kb, s.compiler_output,
                s.ai_declaration, s.logic_explanation, s.annotations, s.annotation_status,
                s.is_final, s.submitted_at, s.created_at, s.updated_at,
                u.display_name AS student_name, u.email AS student_email
         FROM submissions s
         JOIN users u ON s.student_id = u.id
         WHERE s.assignment_id = ?
         ORDER BY s.created_at DESC LIMIT 200`,
        [assignmentId],
      );
      return rows.map((row) => ({
        ...toSubmission(row),
        studentName: row.student_name,
        studentEmail: row.student_email,
      }));
    },

    async updateStatus(id, { status, results, executionTimeMs, memoryKb, compilerOutput }) {
      await pool.execute(
        `UPDATE submissions SET
           status = ?, results = ?, execution_time_ms = ?, memory_kb = ?,
           compiler_output = ?, updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [
          status,
          results ? JSON.stringify(results) : null,
          executionTimeMs ?? null,
          memoryKb ?? null,
          compilerOutput ?? null,
          id,
        ],
      );
      return findOne(`SELECT ${COLUMNS} FROM submissions WHERE id = ? LIMIT 1`, [id]);
    },

    async countFinalByStudentForAssignment(studentId, assignmentId) {
      const [rows] = await pool.execute(
        'SELECT COUNT(*) AS cnt FROM submissions WHERE student_id = ? AND assignment_id = ? AND is_final = 1',
        [studentId, assignmentId],
      );
      return Number(rows[0].cnt);
    },

    async countByStudentForAssignment(studentId, assignmentId) {
      const [rows] = await pool.execute(
        'SELECT COUNT(*) AS cnt FROM submissions WHERE student_id = ? AND assignment_id = ?',
        [studentId, assignmentId],
      );
      return Number(rows[0].cnt);
    },
  };
}
