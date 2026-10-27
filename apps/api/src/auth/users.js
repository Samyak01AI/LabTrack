import { randomUUID } from 'node:crypto';

const PUBLIC_COLUMNS = 'id, display_name, email, role, is_active, created_at';
const AUTH_COLUMNS = 'id, display_name, email, password_hash, role, is_active, created_at';

function toIsoUtc(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') throw new TypeError('Database user timestamp is invalid.');
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new TypeError('Database user timestamp is invalid.');
  return date.toISOString();
}

export function createUserRepository(pool) {
  return {
    async findByEmail(email) {
      const [rows] = await pool.execute(
        `SELECT ${AUTH_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
        [email],
      );
      return rows[0] ?? null;
    },

    async findPublicById(id) {
      const [rows] = await pool.execute(
        `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
        [id],
      );
      return rows[0] ?? null;
    },

    async create({ displayName, email, passwordHash, role }) {
      const id = randomUUID();
      await pool.execute(
        'INSERT INTO users (id, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [id, displayName, email, passwordHash, role],
      );
      return this.findPublicById(id);
    },

    async createOrUpdateTeacher({ displayName, email, passwordHash }) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO users (id, display_name, email, password_hash, role)
         VALUES (?, ?, ?, ?, 'teacher')
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           password_hash = VALUES(password_hash),
           role = 'teacher',
           is_active = 1`,
        [id, displayName, email, passwordHash],
      );
      const [rows] = await pool.execute(
        `SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
        [email],
      );
      return rows[0] ?? null;
    },
  };
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    role: user.role,
    createdAt: toIsoUtc(user.created_at),
  };
}
