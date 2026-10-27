import jwt from 'jsonwebtoken';
import { toPublicUser } from '../auth/users.js';

export function requireAuth({ users, config }) {
  return async function authMiddleware(req, res, next) {
    const token = req.cookies?.[config.cookieName];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    let claims;
    try {
      claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    if (typeof claims.sub !== 'string') return res.status(401).json({ error: 'Invalid session.' });
    const user = await users.findPublicById(claims.sub);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid session.' });
    req.user = toPublicUser(user);
    return next();
  };
}

export function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
    return next();
  };
}
