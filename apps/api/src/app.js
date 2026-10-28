import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import { createUserRepository } from './auth/users.js';
import { createAuthRouter } from './auth/routes.js';
import { createProfileRouter } from './routes/profiles.js';
import { createAssignmentRepository } from './assignments/repository.js';
import { createStudentAssignmentsRouter, createTeacherAssignmentsRouter } from './assignments/routes.js';
import { createSubmissionRepository } from './submissions/repository.js';
import { createJudge0Adapter } from './submissions/judge0.js';
import { createStudentSubmissionsRouter, createTeacherSubmissionsRouter } from './submissions/routes.js';
import { createSimilarityRepository } from './similarity/repository.js';
import { createTeacherSimilarityRouter } from './similarity/routes.js';
import { createGradeRepository } from './grading/repository.js';
import { createTeacherGradingRouter, createStudentGradingRouter } from './grading/routes.js';
import { createReportingRepository } from './reporting/repository.js';
import { createStudentReportingRouter, createTeacherReportingRouter } from './reporting/routes.js';

export function createApp({
  pool,
  config,
  users = createUserRepository(pool),
  frontendMiddleware = null,
  staticDirectory = null,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    frameguard: false,
    contentSecurityPolicy: config.environment === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        formAction: ["'self'"],
        frameAncestors: null,
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      },
    } : false,
  }));
  app.use(express.json({ limit: '256kb', strict: true }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    return next();
  });
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1 AS ready');
    return res.status(200).json({ ok: true });
  });
  app.use('/api/auth', createAuthRouter({ pool, users, config }));
  const assignments = createAssignmentRepository(pool);
  const submissions = createSubmissionRepository(pool);
  const similarity = createSimilarityRepository(pool);
  const grades = createGradeRepository(pool);
  const reporting = createReportingRepository(pool);
  const judge0 = createJudge0Adapter(config);

  app.use('/api/student/assignments', createStudentAssignmentsRouter({ users, config, assignments }));
  app.use('/api/student/assignments', createStudentSubmissionsRouter({ users, config, assignments, submissions, judge0 }));
  app.use('/api/student', createStudentSubmissionsRouter({ users, config, assignments, submissions, judge0 }));
  app.use('/api/student', createStudentGradingRouter({ users, config, assignments, submissions, grades }));
  app.use('/api/student', createStudentReportingRouter({ users, config, reporting }));

  app.use('/api/teacher/assignments', createTeacherAssignmentsRouter({ users, config, assignments }));
  app.use('/api/teacher/assignments', createTeacherSubmissionsRouter({ users, config, assignments, submissions }));
  app.use('/api/teacher', createTeacherSubmissionsRouter({ users, config, assignments, submissions }));
  app.use('/api/teacher', createTeacherSimilarityRouter({ users, config, assignments, submissions, similarity }));
  app.use('/api/teacher', createTeacherGradingRouter({ users, config, assignments, submissions, grades }));
  app.use('/api/teacher', createTeacherReportingRouter({ users, config, assignments, reporting }));

  app.use('/api', createProfileRouter({ users, config }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found.' }));

  if (staticDirectory) {
    app.use(express.static(staticDirectory, {
      index: false,
      maxAge: 0,
      setHeaders(res) { res.setHeader('Cache-Control', 'no-cache'); },
    }));
  }
  if (frontendMiddleware) app.use(frontendMiddleware);
  if (staticDirectory) {
    app.use((req, res, next) => {
      if ((req.method === 'GET' || req.method === 'HEAD')
        && path.extname(req.path) === ''
        && req.accepts('html')) {
        return res.sendFile(path.join(staticDirectory, 'index.html'), {
          headers: { 'Cache-Control': 'no-cache' },
        }, (error) => {
          if (error) next(error);
        });
      }
      return next();
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    console.error('Unhandled API error:', error?.message ?? 'unknown error');
    return res.status(500).json({ error: 'Internal server error.' });
  });
  return app;
}
