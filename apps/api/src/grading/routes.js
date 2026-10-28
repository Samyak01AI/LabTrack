import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { computeProvisionalGrade, calculateTotal, DEFAULT_RUBRIC_WEIGHTS } from './rubric.js';

const idSchema = z.string().uuid();

const evaluateSchema = z.object({
  correctnessScore: z.number().min(0),
  logicScore: z.number().min(0),
  complexityScore: z.number().min(0),
  transparencyScore: z.number().min(0),
  feedback: z.string().max(5000).nullable().optional(),
  status: z.enum(['provisionally_scored', 'finalised']).default('provisionally_scored'),
});

const reopenSchema = z.object({
  reason: z.string().min(5, 'Reopen audit reason must be at least 5 characters.').max(1000),
});

/**
 * Teacher grading & evaluation routes.
 */
export function createTeacherGradingRouter({ users, config, assignments, submissions, grades }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('teacher'));

  // 1. Get submissions queue for an assignment
  router.get('/assignments/:assignmentId/submissions-queue', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const queue = await grades.listQueueByAssignment(assignmentId);
    return res.json({
      assignment: {
        id: assignment.id,
        assignmentCode: assignment.assignmentCode,
        courseCode: assignment.courseCode,
        title: assignment.title,
        maxScore: assignment.maxScore,
      },
      queue,
    });
  });

  // 2. Get detailed submission evaluation data
  router.get('/submissions/:submissionId/evaluation', async (req, res) => {
    const { submissionId } = req.params;
    if (!idSchema.safeParse(submissionId).success) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const submission = await submissions.getById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    // RBAC: Verify requesting teacher owns the assignment
    const assignment = await assignments.getByTeacher(submission.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    let grade = await grades.getGradeBySubmission(submissionId);
    const provisional = computeProvisionalGrade(submission, assignment);

    return res.json({
      assignment,
      submission,
      grade,
      provisionalGrade: provisional,
      rubricWeights: DEFAULT_RUBRIC_WEIGHTS,
    });
  });

  // 3. Save or finalize evaluation
  router.post('/submissions/:submissionId/evaluate', async (req, res) => {
    const { submissionId } = req.params;
    if (!idSchema.safeParse(submissionId).success) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const submission = await submissions.getById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    // RBAC: Verify requesting teacher owns the assignment
    const assignment = await assignments.getByTeacher(submission.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const parseBody = evaluateSchema.safeParse(req.body);
    if (!parseBody.success) {
      return res.status(400).json({ error: 'Invalid evaluation data.', details: parseBody.error.flatten() });
    }

    const { correctnessScore, logicScore, complexityScore, transparencyScore, feedback, status } = parseBody.data;

    const maxScore = Number(assignment.maxScore) || 100;
    const totalScore = calculateTotal(
      { correctnessScore, logicScore, complexityScore, transparencyScore },
      maxScore,
    );

    const rubricScores = {
      correctness: correctnessScore,
      logic: logicScore,
      complexity: complexityScore,
      transparency: transparencyScore,
    };

    const saved = await grades.upsertGrade({
      submissionId,
      assignmentId: assignment.id,
      studentId: submission.studentId,
      teacherId: req.user.id,
      correctnessScore,
      logicScore,
      complexityScore,
      transparencyScore,
      totalScore,
      maxScore,
      status,
      rubricScores,
      feedback: feedback?.trim() || null,
    });

    return res.status(200).json({
      success: true,
      grade: saved,
    });
  });

  // 4. Reopen finalized grade for moderation/review
  router.post('/submissions/:submissionId/reopen', async (req, res) => {
    const { submissionId } = req.params;
    if (!idSchema.safeParse(submissionId).success) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const submission = await submissions.getById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const assignment = await assignments.getByTeacher(submission.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const grade = await grades.getGradeBySubmission(submissionId);
    if (!grade) {
      return res.status(404).json({ error: 'Grade record not found.' });
    }

    if (grade.status !== 'finalised') {
      return res.status(400).json({ error: 'Only finalised grades can be reopened.' });
    }

    const parseBody = reopenSchema.safeParse(req.body);
    if (!parseBody.success) {
      return res.status(400).json({
        error: 'A valid reason is required to reopen a finalised grade.',
        details: parseBody.error.flatten(),
      });
    }

    const updated = await grades.reopenGrade(grade.id, req.user.id, parseBody.data.reason.trim());
    return res.status(200).json({
      success: true,
      grade: updated,
    });
  });

  return router;
}

/**
 * Student scorecard viewing route.
 */
export function createStudentGradingRouter({ users, config, assignments, submissions, grades }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('student'));

  // Get student scorecard for an assignment
  router.get('/assignments/:assignmentId/scorecard', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getPublishedById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    // Get student's latest final submission
    const finalSubs = await submissions.listFinalByStudentForAssignment(req.user.id, assignmentId);
    if (!finalSubs || finalSubs.length === 0) {
      return res.status(404).json({ error: 'No final submission recorded for this assignment.' });
    }

    const latestFinal = finalSubs[0];
    const grade = await grades.getGradeBySubmission(latestFinal.id);

    if (!grade) {
      // Auto-compute provisional breakdown so student can see progress
      const provisional = computeProvisionalGrade(latestFinal, assignment);
      return res.json({
        assignment: {
          id: assignment.id,
          title: assignment.title,
          assignmentCode: assignment.assignmentCode,
          maxScore: assignment.maxScore,
        },
        submission: {
          id: latestFinal.id,
          submittedAt: latestFinal.submittedAt,
          language: latestFinal.language,
        },
        grade: {
          totalScore: provisional.totalScore,
          maxScore: provisional.maxScore,
          status: 'provisionally_scored',
          rubricScores: provisional.rubricBreakdown,
          feedback: null,
          isProvisional: true,
        },
        isProvisional: true,
      });
    }

    return res.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        assignmentCode: assignment.assignmentCode,
        maxScore: assignment.maxScore,
      },
      submission: {
        id: latestFinal.id,
        submittedAt: latestFinal.submittedAt,
        language: latestFinal.language,
      },
      grade: {
        ...grade,
        isProvisional: grade.status !== 'finalised',
      },
      isProvisional: grade.status !== 'finalised',
    });
  });

  return router;
}

