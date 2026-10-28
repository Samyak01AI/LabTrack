import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';

const idSchema = z.string().uuid();

const aiDeclarationSchema = z.object({
  aiUsed: z.boolean(),
  tools: z.array(z.string()).default([]),
  purposes: z.array(z.string()).default([]),
  narrative: z.string().default(''),
  otherTool: z.string().default(''),
  impactPercentage: z.string().default(''),
}).passthrough();

const logicExplanationSchema = z.object({
  approach: z.string().default(''),
  dataStructures: z.string().default(''),
  tradeoffAnalysis: z.string().default(''),
  timeComplexity: z.string().default(''),
  spaceComplexity: z.string().default(''),
}).passthrough();

const annotationSchema = z.object({
  id: z.string().optional(),
  startLine: z.coerce.number().int().min(1),
  endLine: z.coerce.number().int().min(1),
  justification: z.string().trim().min(1, 'Justification is required for each annotated range.'),
  tool: z.string().default(''),
}).strict();

const submitSchema = z.object({
  language: z.enum(['C++20', 'Java 21']),
  sourceCode: z.string().trim().min(1, 'Source code is required.').max(100_000, 'Source code is too large.'),
  isDraft: z.boolean().optional().default(false),
  aiDeclaration: aiDeclarationSchema.optional().nullable(),
  logicExplanation: logicExplanationSchema.optional().nullable(),
  annotations: z.array(annotationSchema).optional().default([]),
}).strict();

const runSchema = z.object({
  language: z.enum(['C++20', 'Java 21']),
  sourceCode: z.string().trim().min(1, 'Source code is required.').max(100_000, 'Source code is too large.'),
}).strict();

function badInput(res, parsed) {
  const issue = parsed.error.issues[0];
  return res.status(400).json({
    error: 'Invalid request.',
    field: String(issue.path[0] ?? ''),
    message: issue.message,
  });
}

export function computeAnnotationStatus(aiDeclaration, annotations) {
  if (!aiDeclaration || !aiDeclaration.aiUsed) {
    return 'not_required';
  }
  if (!annotations || annotations.length === 0) {
    return 'incomplete';
  }
  const allJustified = annotations.every(
    (ann) => ann.justification && ann.justification.trim().length > 0 && ann.startLine > 0 && ann.endLine >= ann.startLine,
  );
  return allJustified ? 'complete' : 'incomplete';
}

/**
 * Student submission routes.
 */
export function createStudentSubmissionsRouter({ users, config, assignments, submissions, judge0 }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('student'));

  // Run code against sample cases without submitting
  router.post('/:assignmentId/run', async (req, res) => {
    const assignmentId = req.params.assignmentId;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) return badInput(res, parsed);

    const assignment = await assignments.getPublishedById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found or not published.' });
    }

    if (!assignment.languageOptions.includes(parsed.data.language)) {
      return res.status(400).json({
        error: `Language '${parsed.data.language}' is not allowed for this assignment. Allowed: ${assignment.languageOptions.join(', ')}.`,
      });
    }

    if (!judge0 || !judge0.available) {
      const pendingResults = (assignment.sampleCases || []).map((sample, index) => ({
        testIndex: index,
        input: sample.input || '',
        expectedOutput: sample.expectedOutput || '',
        actualOutput: 'Runner unavailable: Judge0 sandbox not configured.',
        status: 'pending',
        timeMs: 0,
        memoryKb: 0,
        stderr: null,
      }));
      return res.status(200).json({
        status: 'pending',
        results: pendingResults,
        executionTimeMs: 0,
        memoryKb: 0,
        compilerOutput: 'Notice: Sandboxed execution engine (Judge0) is not configured in this environment.',
      });
    }

    try {
      const result = await judge0.executeSubmission(
        parsed.data.sourceCode,
        parsed.data.language,
        assignment.sampleCases,
      );
      return res.status(200).json(result);
    } catch (execError) {
      return res.status(200).json({
        status: 'internal_error',
        results: [],
        executionTimeMs: 0,
        memoryKb: 0,
        compilerOutput: `Sandbox execution error: ${execError.message}`,
      });
    }
  });

  // Submit code or save draft
  router.post('/:assignmentId/submit', async (req, res) => {
    const assignmentId = req.params.assignmentId;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) return badInput(res, parsed);

    const assignment = await assignments.getPublishedById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found or not published.' });
    }

    if (!assignment.languageOptions.includes(parsed.data.language)) {
      return res.status(400).json({
        error: `Language '${parsed.data.language}' is not allowed for this assignment. Allowed: ${assignment.languageOptions.join(', ')}.`,
      });
    }

    const {
      language,
      sourceCode,
      isDraft,
      aiDeclaration,
      logicExplanation,
      annotations = [],
    } = parsed.data;

    const annotationStatus = computeAnnotationStatus(aiDeclaration, annotations);

    // If saving a draft, allow partial data and do not consume submission quota
    if (isDraft) {
      const draft = await submissions.saveDraft({
        assignmentId,
        studentId: req.user.id,
        language,
        sourceCode,
        aiDeclaration,
        logicExplanation,
        annotations,
        annotationStatus,
      });
      return res.status(200).json({ submission: draft });
    }

    // --- FINAL SUBMISSION VALIDATION (Strict Acceptance Criteria) ---
    // 1. Mandatory AI-Use Declaration
    if (!aiDeclaration || typeof aiDeclaration.aiUsed !== 'boolean') {
      return res.status(400).json({
        error: 'AI-Use declaration is mandatory. Please complete Step 2 before submitting.',
        field: 'aiDeclaration',
      });
    }

    if (aiDeclaration.aiUsed) {
      if ((!aiDeclaration.tools || aiDeclaration.tools.length === 0) && !aiDeclaration.otherTool?.trim()) {
        return res.status(400).json({
          error: 'Please specify which AI tools or models were utilized during problem solving.',
          field: 'aiDeclaration.tools',
        });
      }
      // If AI was declared, student must provide code annotations (cannot submit with incomplete annotations)
      if (annotationStatus !== 'complete') {
        return res.status(400).json({
          error: 'AI assistance was declared, but code annotations are incomplete. You must annotate AI-assisted code lines and justify each before final submission.',
          field: 'annotations',
        });
      }
    }

    // 2. Mandatory Logic Explanation
    const totalExplLen =
      (logicExplanation?.approach?.trim().length || 0) +
      (logicExplanation?.dataStructures?.trim().length || 0) +
      (logicExplanation?.tradeoffAnalysis?.trim().length || 0);

    if (!logicExplanation || totalExplLen < 60) {
      return res.status(400).json({
        error: 'Conceptual logic explanation is too short. Minimum 60 characters required across logic, approach, and data structure justifications.',
        field: 'logicExplanation',
      });
    }

    if (totalExplLen > 5000) {
      return res.status(400).json({
        error: 'Logic explanation exceeds maximum allowed length of 5000 characters.',
        field: 'logicExplanation',
      });
    }

    // 3. Final submission rate limit (max 20 final submissions per student per assignment)
    const finalCount = await submissions.countFinalByStudentForAssignment(req.user.id, assignmentId);
    if (finalCount >= 20) {
      return res.status(429).json({ error: 'Maximum submission limit (20) reached for this assignment.' });
    }

    // 4. Create immutable final submission snapshot
    let submission = await submissions.create({
      assignmentId,
      studentId: req.user.id,
      language,
      sourceCode,
      status: 'queued',
      aiDeclaration,
      logicExplanation,
      annotations,
      annotationStatus,
      isFinal: true,
      submittedAt: new Date().toISOString(),
    });

    // 5. Execute sandbox test cases if Judge0 is available
    if (judge0?.available && assignment.sampleCases?.length > 0) {
      try {
        const result = await judge0.executeSubmission(
          sourceCode,
          language,
          assignment.sampleCases,
        );
        submission = await submissions.updateStatus(submission.id, {
          status: result.status,
          results: result.results,
          executionTimeMs: result.executionTimeMs,
          memoryKb: result.memoryKb,
          compilerOutput: result.compilerOutput,
        });
      } catch (execError) {
        console.error('Judge0 execution error:', execError.message);
        submission = await submissions.updateStatus(submission.id, {
          status: 'internal_error',
          results: null,
          executionTimeMs: null,
          memoryKb: null,
          compilerOutput: `Sandbox error: ${execError.message}`,
        });
      }
    }

    return res.status(201).json({ submission });
  });

  // Get latest draft or submission for student on assignment
  router.get('/:assignmentId/submissions/latest', async (req, res) => {
    const assignmentId = req.params.assignmentId;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    // Look for active draft first; fallback to latest submission
    const draft = await submissions.getLatestDraft(req.user.id, assignmentId);
    if (draft) return res.json({ submission: draft });

    const latest = await submissions.getLatestByStudentForAssignment(req.user.id, assignmentId);
    return res.json({ submission: latest || null });
  });

  // List own submissions for an assignment
  router.get('/:assignmentId/submissions', async (req, res) => {
    const assignmentId = req.params.assignmentId;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const items = await submissions.listByStudentForAssignment(req.user.id, assignmentId);
    return res.json({ submissions: items });
  });

  // Get a specific submission detail
  router.get('/submissions/:id', async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const submission = await submissions.getByIdForStudent(req.params.id, req.user.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });
    return res.json({ submission });
  });

  return router;
}

/**
 * Teacher submission viewing routes.
 */
export function createTeacherSubmissionsRouter({ users, config, assignments, submissions }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('teacher'));

  // List all submissions for a teacher's assignment
  router.get('/:assignmentId/submissions', async (req, res) => {
    const assignmentId = req.params.assignmentId;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const items = await submissions.listByAssignment(assignmentId);
    return res.json({ submissions: items });
  });

  // Get a specific submission
  router.get('/submissions/:id', async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const submission = await submissions.getById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    const assignment = await assignments.getByTeacher(submission.assignmentId, req.user.id);
    if (!assignment) return res.status(404).json({ error: 'Submission not found.' });

    return res.json({ submission });
  });

  return router;
}
