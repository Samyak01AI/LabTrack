import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAiAssistant } from './service.js';

const idSchema = z.string().uuid();

const assistRequestSchema = z.object({
  mode: z.enum(['hint', 'debug', 'complexity']),
  prompt: z.string().min(3, 'Query must be at least 3 characters long.').max(1000),
  sourceCode: z.string().max(15000).optional().default(''),
  language: z.enum(['C++20', 'Java 21']).optional().default('C++20'),
});

export function createStudentAiRouter({ users, config, assignments, aiRepo }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('student'));

  // 1. Get AI assistance availability & rate limit status
  router.get('/assignments/:id/ai-status', async (req, res) => {
    const { id } = req.params;
    if (!idSchema.safeParse(id).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getPublishedById(id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    if (!config.enableAiAssistance) {
      return res.json({
        enabled: false,
        reason: 'AI assistance is disabled by course policy or server configuration.',
        hourlyLimit: 0,
        usedInLastHour: 0,
        remainingQueries: 0,
      });
    }

    const hourlyLimit = config.aiRateLimitHourlyMax || 5;
    const usedInLastHour = await aiRepo.getRecentHourlyCount(req.user.id, id);
    const remainingQueries = Math.max(0, hourlyLimit - usedInLastHour);

    return res.json({
      enabled: true,
      hourlyLimit,
      usedInLastHour,
      remainingQueries,
    });
  });

  // 2. Get student's previous in-platform AI logs for assignment
  router.get('/assignments/:id/ai-logs', async (req, res) => {
    const { id } = req.params;
    if (!idSchema.safeParse(id).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const logs = await aiRepo.getStudentLogs(req.user.id, id);
    return res.json({ logs });
  });

  // 3. Request pedagogical AI assistance
  router.post('/assignments/:id/ai-assist', async (req, res) => {
    const { id } = req.params;
    if (!idSchema.safeParse(id).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    // Strict Feature Flag Check
    if (!config.enableAiAssistance) {
      return res.status(503).json({
        error: 'AI assistance is disabled by course policy for this assignment or server configuration.',
      });
    }

    const assignment = await assignments.getPublishedById(id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const parseResult = assistRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error.issues.map((i) => i.message).join('; ');
      return res.status(400).json({ error: `Validation error: ${msg}` });
    }

    const { mode, prompt, sourceCode, language } = parseResult.data;

    // Rate Limiting Check
    const hourlyLimit = config.aiRateLimitHourlyMax || 5;
    const usedInLastHour = await aiRepo.getRecentHourlyCount(req.user.id, id);
    if (usedInLastHour >= hourlyLimit) {
      return res.status(429).json({
        error: `AI assistance query limit reached (${hourlyLimit} queries per hour). Please spend time thinking independently and verifying your invariants.`,
      });
    }

    try {
      // Query Pedagogical Service
      const result = await queryAiAssistant(
        {
          mode,
          prompt,
          sourceCode,
          language,
          assignmentTitle: assignment.title,
        },
        config,
      );

      // Audit Log Interaction
      const logged = await aiRepo.logInteraction({
        assignmentId: id,
        studentId: req.user.id,
        mode,
        prompt,
        response: result.response,
        codeSnippet: sourceCode,
        tokensUsed: result.tokensUsed || 0,
      });

      const remainingQueries = Math.max(0, hourlyLimit - (usedInLastHour + 1));

      return res.json({
        response: result.response,
        mode,
        remainingQueries,
        hourlyLimit,
        attribution: {
          id: logged.id,
          tool: 'LabTrack In-Platform AI Assistant',
          mode,
          promptSnippet: prompt.slice(0, 100),
          summary: `Mode: ${mode.toUpperCase()} - Query: "${prompt.slice(0, 80)}..."`,
          timestamp: logged.createdAt,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: `AI Assistant service error: ${err.message}` });
    }
  });

  return router;
}

export function createTeacherAiRouter({ users, config, assignments, aiRepo }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('teacher'));

  // Get student AI audit logs for assignment
  router.get('/assignments/:assignmentId/students/:studentId/ai-logs', async (req, res) => {
    const { assignmentId, studentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success || !idSchema.safeParse(studentId).success) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    // Verify Teacher Assignment Ownership
    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const logs = await aiRepo.getTeacherAuditLogs(studentId, assignmentId);
    return res.json({ logs });
  });

  return router;
}
