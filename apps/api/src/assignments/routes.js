import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isUniqueViolation } from '../db/errors.js';

const sampleCaseSchema = z.object({
  input: z.string().max(4000),
  expectedOutput: z.string().max(4000),
  explanation: z.string().max(2000).optional().default(''),
}).strict();

const assignmentShape = {
  courseCode: z.string().trim().min(2).max(32),
  assignmentCode: z.string().trim().min(1).max(32),
  title: z.string().trim().min(3).max(160),
  topic: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(10).max(240),
  problemStatement: z.string().trim().min(20).max(30000),
  constraintsMarkdown: z.string().max(12000).default(''),
  sampleCases: z.array(sampleCaseSchema).max(20).default([]),
  dueAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
  maxScore: z.number().int().min(1).max(1000).default(100),
  languageOptions: z.array(z.enum(['C++20', 'Java 21'])).min(1).max(2),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
};
const createSchema = z.object(assignmentShape).strict();
const patchSchema = z.object({
  courseCode: assignmentShape.courseCode.optional(),
  assignmentCode: assignmentShape.assignmentCode.optional(),
  title: assignmentShape.title.optional(),
  topic: assignmentShape.topic.optional(),
  summary: assignmentShape.summary.optional(),
  problemStatement: assignmentShape.problemStatement.optional(),
  constraintsMarkdown: assignmentShape.constraintsMarkdown.optional(),
  sampleCases: assignmentShape.sampleCases.optional(),
  dueAt: assignmentShape.dueAt.optional(),
  maxScore: assignmentShape.maxScore.optional(),
  languageOptions: assignmentShape.languageOptions.optional(),
  status: assignmentShape.status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');
const idSchema = z.string().uuid();

function badInput(res, parsed) {
  const issue = parsed.error.issues[0];
  return res.status(400).json({
    error: 'Invalid request.',
    field: String(issue.path[0] ?? ''),
    message: issue.message,
  });
}

function mergeInput(current, patch) {
  return {
    courseCode: patch.courseCode ?? current.courseCode,
    assignmentCode: patch.assignmentCode ?? current.assignmentCode,
    title: patch.title ?? current.title,
    topic: patch.topic ?? current.topic,
    summary: patch.summary ?? current.summary,
    problemStatement: patch.problemStatement ?? current.problemStatement,
    constraintsMarkdown: patch.constraintsMarkdown ?? current.constraintsMarkdown,
    sampleCases: patch.sampleCases ?? current.sampleCases,
    dueAt: patch.dueAt ?? new Date(current.dueAt).toISOString(),
    maxScore: patch.maxScore ?? current.maxScore,
    languageOptions: patch.languageOptions ?? current.languageOptions,
    status: patch.status ?? current.status,
  };
}

export function createStudentAssignmentsRouter({ users, config, assignments }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('student'));
  router.get('/', async (_req, res) => {
    const items = await assignments.listPublished();
    return res.json({ assignments: items });
  });
  router.get('/:id', async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Assignment not found.' });
    const assignment = await assignments.getPublishedById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    return res.json({ assignment });
  });
  return router;
}

export function createTeacherAssignmentsRouter({ users, config, assignments }) {
  const router = Router();
  router.use(requireAuth({ users, config }), requireRole('teacher'));
  router.get('/', async (req, res) => {
    const items = await assignments.listByTeacher(req.user.id);
    return res.json({ assignments: items });
  });
  router.get('/:id', async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Assignment not found.' });
    const assignment = await assignments.getByTeacher(req.params.id, req.user.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    return res.json({ assignment });
  });
  router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return badInput(res, parsed);
    try {
      const assignment = await assignments.create(req.user.id, parsed.data);
      return res.status(201).json({ assignment });
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: 'You already have an assignment with that code.' });
      throw error;
    }
  });
  router.patch('/:id', async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Assignment not found.' });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return badInput(res, parsed);
    const current = await assignments.getByTeacher(req.params.id, req.user.id);
    if (!current) return res.status(404).json({ error: 'Assignment not found.' });
    const merged = createSchema.safeParse(mergeInput(current, parsed.data));
    if (!merged.success) return badInput(res, merged);
    try {
      const assignment = await assignments.updateByTeacher(req.params.id, req.user.id, merged.data);
      return res.json({ assignment });
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: 'You already have an assignment with that code.' });
      throw error;
    }
  });
  router.delete('/:id', async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Assignment not found.' });
    const deleted = await assignments.deleteDraftByTeacher(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Draft assignment not found.' });
    return res.status(204).end();
  });
  return router;
}
