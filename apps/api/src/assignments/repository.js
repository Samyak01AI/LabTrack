import { randomUUID } from 'node:crypto';

const COLUMNS = `id, created_by, course_code, assignment_code, title, topic, summary,
  problem_statement, constraints_markdown, sample_cases, due_at, max_score,
  language_options, status, created_at, updated_at`;

function parseJson(value) {
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

function toMysqlUtc(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Assignment deadline is invalid.');
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function toAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseCode: row.course_code,
    assignmentCode: row.assignment_code,
    title: row.title,
    topic: row.topic,
    summary: row.summary,
    problemStatement: row.problem_statement,
    constraintsMarkdown: row.constraints_markdown,
    sampleCases: parseJson(row.sample_cases),
    dueAt: toIsoUtc(row.due_at),
    maxScore: row.max_score,
    languageOptions: parseJson(row.language_options),
    status: row.status,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export function createAssignmentRepository(pool) {
  async function findOne(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return toAssignment(rows[0]);
  }

  async function readById(id) {
    return findOne(`SELECT ${COLUMNS} FROM assignments WHERE id = ? LIMIT 1`, [id]);
  }

  return {
    async listPublished() {
      const [rows] = await pool.execute(
        `SELECT ${COLUMNS} FROM assignments
         WHERE status = 'published' ORDER BY due_at ASC, title ASC LIMIT 500`,
      );
      return rows.map(toAssignment);
    },

    async getPublishedById(id) {
      return findOne(
        `SELECT ${COLUMNS} FROM assignments
         WHERE id = ? AND status = 'published' LIMIT 1`,
        [id],
      );
    },

    async listByTeacher(teacherId) {
      const [rows] = await pool.execute(
        `SELECT ${COLUMNS} FROM assignments
         WHERE created_by = ? ORDER BY updated_at DESC, title ASC LIMIT 500`,
        [teacherId],
      );
      return rows.map(toAssignment);
    },

    async getByTeacher(id, teacherId) {
      return findOne(
        `SELECT ${COLUMNS} FROM assignments
         WHERE id = ? AND created_by = ? LIMIT 1`,
        [id, teacherId],
      );
    },

    async create(teacherId, input) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO assignments (
          id, created_by, course_code, assignment_code, title, topic, summary,
          problem_statement, constraints_markdown, sample_cases, due_at,
          max_score, language_options, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, teacherId, input.courseCode, input.assignmentCode, input.title,
          input.topic, input.summary, input.problemStatement,
          input.constraintsMarkdown, JSON.stringify(input.sampleCases), toMysqlUtc(input.dueAt),
          input.maxScore, JSON.stringify(input.languageOptions), input.status,
        ],
      );
      return readById(id);
    },

    async updateByTeacher(id, teacherId, input) {
      await pool.execute(
        `UPDATE assignments SET
          course_code = ?, assignment_code = ?, title = ?, topic = ?,
          summary = ?, problem_statement = ?, constraints_markdown = ?,
          sample_cases = ?, due_at = ?, max_score = ?, language_options = ?,
          status = ?, updated_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND created_by = ?`,
        [
          input.courseCode, input.assignmentCode, input.title, input.topic,
          input.summary, input.problemStatement, input.constraintsMarkdown,
          JSON.stringify(input.sampleCases), toMysqlUtc(input.dueAt), input.maxScore,
          JSON.stringify(input.languageOptions), input.status, id, teacherId,
        ],
      );
      return findOne(
        `SELECT ${COLUMNS} FROM assignments WHERE id = ? AND created_by = ? LIMIT 1`,
        [id, teacherId],
      );
    },

    async deleteDraftByTeacher(id, teacherId) {
      const [result] = await pool.execute(
        `DELETE FROM assignments
         WHERE id = ? AND created_by = ? AND status = 'draft'`,
        [id, teacherId],
      );
      return result.affectedRows > 0;
    },
  };
}
