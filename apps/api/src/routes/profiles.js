import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export function createProfileRouter({ users, config }) {
  const router = Router();
  const auth = requireAuth({ users, config });
  router.get('/student/me', auth, requireRole('student'), (req, res) => res.json({ user: req.user }));
  router.get('/teacher/me', auth, requireRole('teacher'), (req, res) => res.json({ user: req.user }));
  return router;
}
