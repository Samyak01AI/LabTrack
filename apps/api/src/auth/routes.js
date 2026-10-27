import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { toPublicUser } from './users.js';
import { isUniqueViolation } from '../db/errors.js';

const registrationSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

function validationMessage(result) {
  const first = result.error.issues[0];
  return { error: 'Invalid request.', field: String(first.path[0] ?? ''), message: first.message };
}

export function createAuthRouter({ pool, users, config }) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    return next();
  });
  const auth = requireAuth({ users, config });
  const loginLimiter = rateLimit({
    windowMs: config.loginRateLimitWindowMs,
    limit: config.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.environment === 'test',
    message: { error: 'Too many login attempts. Try again later.' },
  });
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: config.cookieMaxAgeMs,
  };

  router.post('/register', async (req, res) => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationMessage(parsed));
    const input = parsed.data;
    const email = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await users.create({
        displayName: input.displayName,
        email,
        passwordHash,
        role: 'student',
      });
      return res.status(201).json({ user: toPublicUser(user) });
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: 'An account with that email already exists.' });
      throw error;
    }
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationMessage(parsed));
    const email = parsed.data.email.toLowerCase();
    const user = await users.findByEmail(email);
    const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
    if (!user || !user.is_active || !passwordMatches) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    });
    res.cookie(config.cookieName, token, cookieOptions);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ user: toPublicUser(user) });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      path: '/',
    });
    return res.status(204).end();
  });

  router.get('/me', auth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ user: req.user });
  });

  return router;
}
