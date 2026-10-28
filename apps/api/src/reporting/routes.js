import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateCohortMetrics, generateCohortCsv, escapeCsvField } from './analytics.js';

const idSchema = z.string().uuid();

export function createStudentReportingRouter({ users, config, reporting }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('student'));

  // 1. Get submission history
  router.get('/submissions/history', async (req, res) => {
    const assignmentId = req.query.assignmentId;
    if (assignmentId && !idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const history = await reporting.getStudentSubmissionHistory(req.user.id, assignmentId || null);
    return res.json({ history });
  });

  // 2. Export student submission history as CSV
  router.get('/submissions/history/export', async (req, res) => {
    const history = await reporting.getStudentSubmissionHistory(req.user.id, null);

    const headers = [
      'Submission ID',
      'Course',
      'Assignment Code',
      'Assignment Title',
      'Language',
      'Status',
      'Submitted At',
      'Tests Passed',
      'Total Tests',
      'AI Declared',
      'AI Tools',
      'Total Score',
      'Max Score',
      'Grade Status',
    ];

    const rows = [headers.map(escapeCsvField).join(',')];
    for (const item of history) {
      rows.push([
        item.submissionId,
        item.courseCode,
        item.assignmentCode,
        item.assignmentTitle,
        item.language,
        item.isFinal ? 'Final Submission' : 'Draft',
        item.submittedAt || item.createdAt,
        item.passedTests,
        item.totalTests,
        item.aiDeclared ? 'YES' : 'NO',
        item.aiTools.join('; '),
        item.grade?.totalScore ?? 'N/A',
        item.maxScore,
        item.grade?.status ?? 'Pending',
      ].map(escapeCsvField).join(','));
    }

    const csv = rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="labtrack_submission_history.csv"');
    return res.status(200).send(csv);
  });

  return router;
}

export function createTeacherReportingRouter({ users, config, assignments, reporting }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('teacher'));

  // 1. Get cohort metrics & distribution
  router.get('/assignments/:assignmentId/cohort-metrics', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const cohort = await reporting.getCohortResults(assignmentId);
    const metrics = calculateCohortMetrics(cohort, assignment.maxScore);

    return res.json({
      assignment: {
        id: assignment.id,
        assignmentCode: assignment.assignmentCode,
        courseCode: assignment.courseCode,
        title: assignment.title,
        maxScore: assignment.maxScore,
        dueAt: assignment.dueAt,
      },
      metrics,
    });
  });

  // 2. Get cohort results table roster
  router.get('/assignments/:assignmentId/cohort-results', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const roster = await reporting.getCohortResults(assignmentId);

    return res.json({
      assignment: {
        id: assignment.id,
        assignmentCode: assignment.assignmentCode,
        courseCode: assignment.courseCode,
        title: assignment.title,
        maxScore: assignment.maxScore,
        dueAt: assignment.dueAt,
      },
      roster,
    });
  });

  // 3. Export cohort results table as CSV
  router.get('/assignments/:assignmentId/export/csv', async (req, res) => {
    const { assignmentId } = req.params;
    if (!idSchema.safeParse(assignmentId).success) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const assignment = await assignments.getByTeacher(assignmentId, req.user.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const roster = await reporting.getCohortResults(assignmentId);
    const csvContent = generateCohortCsv(roster, assignment);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${assignment.assignmentCode || 'cohort'}_results.csv"`,
    );
    return res.status(200).send(csvContent);
  });

  return router;
}

