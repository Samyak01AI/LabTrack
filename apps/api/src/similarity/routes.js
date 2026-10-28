import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { compareSubmissions } from './engine.js';

const idSchema = z.string().uuid();
const runOptionsSchema = z.object({
  threshold: z.number().int().min(50).max(95).default(75),
  k: z.number().int().min(3).max(10).default(5),
  w: z.number().int().min(2).max(10).default(4),
}).partial();

const patchSchema = z.object({
  status: z.enum(['flagged', 'reviewed', 'dismissed']).optional(),
  teacherNotes: z.string().max(10000).nullable().optional(),
});

export function createTeacherSimilarityRouter({ users, config, assignments, submissions, similarity }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('teacher'));

  // 1. List similarity reports for an assignment
  router.get('/assignments/:assignmentId/similarity', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const threshold = req.query.threshold ? Number(req.query.threshold) : 0;
    const status = req.query.status || 'all';

    const reports = await similarity.listByAssignment(assignmentId, { threshold, status });
    return res.json({
      assignment: {
        id: assignment.id,
        assignmentCode: assignment.assignmentCode,
        courseCode: assignment.courseCode,
        title: assignment.title,
      },
      reports,
    });
  });

  // 2. Trigger pairwise similarity calculation across all final submissions
  router.post('/assignments/:assignmentId/similarity/run', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const parseOptions = runOptionsSchema.safeParse(req.body || {});
    if (!parseOptions.success) {
      return res.status(400).json({ error: 'Invalid run options.', details: parseOptions.error.flatten() });
    }
    const { threshold = 75, k = 5, w = 4 } = parseOptions.data;

    // Fetch all submissions for the assignment
    const allSubs = await submissions.listByAssignment(assignmentId);
    // Keep only final submissions (isFinal === true)
    const finalSubs = allSubs.filter((s) => s.isFinal);

    // Deduplicate by studentId, keeping the latest final submission per student
    const studentLatest = new Map();
    for (const sub of finalSubs) {
      if (!studentLatest.has(sub.studentId)) {
        studentLatest.set(sub.studentId, sub);
      }
    }
    const eligibleSubmissions = Array.from(studentLatest.values());

    let pairsCompared = 0;
    let flaggedCount = 0;

    // Run pairwise comparison across same-language submissions
    for (let i = 0; i < eligibleSubmissions.length; i++) {
      for (let j = i + 1; j < eligibleSubmissions.length; j++) {
        const subA = eligibleSubmissions[i];
        const subB = eligibleSubmissions[j];

        // Only compare same programming language
        if (subA.language !== subB.language) continue;

        pairsCompared++;
        const result = compareSubmissions(subA, subB, {
          starterCode: assignment.problemStatement || '',
          threshold,
          k,
          w,
        });

        if (result.similarityScore >= threshold) {
          flaggedCount++;
        }

        await similarity.upsertReport({
          assignmentId,
          submissionAId: subA.id,
          submissionBId: subB.id,
          similarityScore: result.similarityScore,
          tokenSimilarity: result.tokenSimilarity,
          astIsomorphism: result.astIsomorphism,
          matchedSegments: result.matchedSegments,
          metrics: result.metrics,
          thresholdUsed: threshold,
          status: result.status,
          teacherNotes: null,
        });
      }
    }

    const reports = await similarity.listByAssignment(assignmentId, { threshold: 0, status: 'all' });
    return res.status(200).json({
      success: true,
      analyzedSubmissions: eligibleSubmissions.length,
      pairsCompared,
      flaggedCount,
      reports,
    });
  });

  // 3. Get single pair similarity report details
  router.get('/similarity/:id', async (req, res) => {
    const { id } = req.params;
    if (!idSchema.safeParse(id).success) {
      return res.status(404).json({ error: 'Similarity report not found.' });
    }

    const report = await similarity.getById(id);
    if (!report) {
      return res.status(404).json({ error: 'Similarity report not found.' });
    }

    // RBAC: Verify requesting teacher owns the assignment
    const assignment = await assignments.getByTeacher(report.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Similarity report not found.' });
    }

    return res.json({
      assignment: {
        id: assignment.id,
        assignmentCode: assignment.assignmentCode,
        courseCode: assignment.courseCode,
        title: assignment.title,
      },
      report,
    });
  });

  // 4. Update status or teacher notes on a report
  router.patch('/similarity/:id', async (req, res) => {
    const { id } = req.params;
    if (!idSchema.safeParse(id).success) {
      return res.status(404).json({ error: 'Similarity report not found.' });
    }

    const report = await similarity.getById(id);
    if (!report) {
      return res.status(404).json({ error: 'Similarity report not found.' });
    }

    // RBAC: Verify requesting teacher owns the assignment
    const assignment = await assignments.getByTeacher(report.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Similarity report not found.' });
    }

    const parseBody = patchSchema.safeParse(req.body);
    if (!parseBody.success) {
      return res.status(400).json({ error: 'Invalid update payload.', details: parseBody.error.flatten() });
    }

    const updated = await similarity.updateReport(id, parseBody.data);
    return res.json({ report: updated });
  });

  return router;
}

