import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function TeacherMarkingPage() {
  const { assignmentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState([]);
  const [assignment, setAssignment] = useState(null);

  // Active submission inspection state
  const selectedSubmissionId = searchParams.get('submissionId') || (queue[0]?.submissionId ?? null);
  const [activeData, setActiveData] = useState(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code', 'tests', 'disclosure', 'logic', 'annotations'

  // Rubric scoring form state
  const [scores, setScores] = useState({
    correctness: 0,
    logic: 0,
    complexity: 0,
    transparency: 0,
  });
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [studentAiLogs, setStudentAiLogs] = useState([]);

  // Queue filter
  const [queueFilter, setQueueFilter] = useState('all'); // 'all', 'pending', 'provisional', 'finalised'

  // Load submissions queue
  const loadQueue = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api(`/api/teacher/assignments/${assignmentId}/submissions-queue`);
      setQueue(res.queue || []);
      setAssignment(res.assignment || null);
    } catch (err) {
      setError(err.message || 'Failed to load submissions queue.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Load detailed submission and evaluation data when selectedSubmissionId changes
  useEffect(() => {
    if (!selectedSubmissionId) {
      setActiveData(null);
      return;
    }
    setActiveLoading(true);
    api(`/api/teacher/submissions/${selectedSubmissionId}/evaluation`)
      .then((res) => {
        setActiveData(res);
        const g = res.grade || res.provisionalGrade;
        if (g) {
          setScores({
            correctness: g.correctnessScore ?? g.rubricBreakdown?.correctness?.score ?? 0,
            logic: g.logicScore ?? g.rubricBreakdown?.logic?.score ?? 0,
            complexity: g.complexityScore ?? g.rubricBreakdown?.complexity?.score ?? 0,
            transparency: g.transparencyScore ?? g.rubricBreakdown?.transparency?.score ?? 0,
          });
          setFeedback(res.grade?.feedback || '');
        }

        // Fetch student's in-platform AI logs if available
        if (res.submission?.assignmentId && res.submission?.studentId) {
          api(`/api/teacher/assignments/${res.submission.assignmentId}/students/${res.submission.studentId}/ai-logs`)
            .then((aiRes) => setStudentAiLogs(aiRes.logs || []))
            .catch(() => setStudentAiLogs([]));
        } else {
          setStudentAiLogs([]);
        }
      })
      .catch((err) => {
        setError(`Failed to load submission: ${err.message}`);
      })
      .finally(() => {
        setActiveLoading(false);
      });
  }, [selectedSubmissionId]);

  // Queue navigation
  const currentIndex = useMemo(() => {
    if (!queue.length || !selectedSubmissionId) return -1;
    return queue.findIndex((q) => q.submissionId === selectedSubmissionId);
  }, [queue, selectedSubmissionId]);

  const prevStudent = currentIndex > 0 ? queue[currentIndex - 1] : null;
  const nextStudent = currentIndex >= 0 && currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null;

  function selectSubmission(id) {
    setSearchParams({ submissionId: id });
  }

  // Filtered queue
  const filteredQueue = useMemo(() => {
    if (queueFilter === 'all') return queue;
    if (queueFilter === 'pending') return queue.filter((q) => q.status === 'pending_review');
    if (queueFilter === 'provisional') return queue.filter((q) => q.status === 'provisionally_scored' || q.status === 'reopened');
    if (queueFilter === 'finalised') return queue.filter((q) => q.status === 'finalised');
    return queue;
  }, [queue, queueFilter]);

  // Live total score calculation
  const totalScore = useMemo(() => {
    const sum = Number(scores.correctness || 0) + Number(scores.logic || 0) + Number(scores.complexity || 0) + Number(scores.transparency || 0);
    const max = Number(assignment?.maxScore) || 100;
    return Math.min(max, Math.round(sum * 100) / 100);
  }, [scores, assignment?.maxScore]);

  // Save evaluation (provisional or finalized)
  async function handleSave(statusToSet) {
    if (!selectedSubmissionId) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api(`/api/teacher/submissions/${selectedSubmissionId}/evaluate`, {
        method: 'POST',
        body: {
          correctnessScore: Number(scores.correctness),
          logicScore: Number(scores.logic),
          complexityScore: Number(scores.complexity),
          transparencyScore: Number(scores.transparency),
          feedback,
          status: statusToSet,
        },
      });
      setActiveData((prev) => ({ ...prev, grade: res.grade }));
      setNotice(statusToSet === 'finalised' ? 'Mark finalised successfully.' : 'Provisional mark saved.');
      setTimeout(() => setNotice(''), 3000);
      // Refresh queue status in memory
      setQueue((prev) =>
        prev.map((item) =>
          item.submissionId === selectedSubmissionId
            ? { ...item, status: statusToSet, totalScore: res.grade.totalScore }
            : item,
        ),
      );
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  // Reopen finalized grade
  async function handleReopenSubmit(e) {
    e.preventDefault();
    if (!selectedSubmissionId || !reopenReason.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      const res = await api(`/api/teacher/submissions/${selectedSubmissionId}/reopen`, {
        method: 'POST',
        body: { reason: reopenReason },
      });
      setActiveData((prev) => ({ ...prev, grade: res.grade }));
      setReopenModalOpen(false);
      setReopenReason('');
      setNotice('Grade reopened for audit and modification.');
      setTimeout(() => setNotice(''), 3000);
      setQueue((prev) =>
        prev.map((item) =>
          item.submissionId === selectedSubmissionId ? { ...item, status: 'reopened' } : item,
        ),
      );
    } catch (err) {
      setError(`Reopen failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  const activeGrade = activeData?.grade;
  const isFinalised = activeGrade?.status === 'finalised';
  const submission = activeData?.submission;

  // Annotated lines set
  const annotatedLines = useMemo(() => {
    const set = new Set();
    const annots = submission?.annotations || [];
    for (const a of annots) {
      for (let i = a.startLine; i <= a.endLine; i++) {
        set.add(i);
      }
    }
    return set;
  }, [submission?.annotations]);

  const sourceLines = useMemo(() => {
    return (submission?.sourceCode || '').split('\n');
  }, [submission?.sourceCode]);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body-md text-on-surface">
      {/* Top Academic Context & Breadcrumbs Bar */}
      <section className="w-full bg-surface-container-lowest border-b border-surface-container px-6 py-3 flex flex-col gap-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/teacher/assignments"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container text-primary font-label-md text-xs hover:bg-surface-container-high transition-colors font-medium"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Assignments</span>
            </Link>
            <div className="h-4 w-px bg-outline-variant/40"></div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Course:</span>
              <span className="text-sm font-bold text-primary">{assignment?.courseCode || 'CS301'}</span>
              <span className="text-xs text-on-surface-variant font-medium">• {assignment?.title}</span>
            </div>
          </div>

          {/* Quick Student Navigation */}
          {queue.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium transition-colors disabled:opacity-40"
                onClick={() => prevStudent && selectSubmission(prevStudent.submissionId)}
                disabled={!prevStudent}
                title={prevStudent ? `Previous: ${prevStudent.studentName}` : 'No previous student'}
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                <span>Prev Student</span>
              </button>
              <span className="font-mono text-xs font-bold text-primary px-2">
                {currentIndex + 1} of {queue.length} Submissions
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium transition-colors disabled:opacity-40"
                onClick={() => nextStudent && selectSubmission(nextStudent.submissionId)}
                disabled={!nextStudent}
                title={nextStudent ? `Next: ${nextStudent.studentName}` : 'No next student'}
              >
                <span>Next Student</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {/* Real-time stats strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-container-low text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-primary">{assignment?.assignmentCode}: {assignment?.title}</span>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-mono text-[11px]">
                {queue.length} Submissions
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-[11px] font-semibold">
                {queue.filter((q) => q.status === 'pending_review' || q.status === 'provisionally_scored').length} Needs Review
              </span>
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-900 font-mono text-[11px] font-semibold">
                {queue.filter((q) => q.status === 'finalised').length} Finalised
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant font-mono text-[11px]">
            <span>Max Score: <strong className="text-primary">{assignment?.maxScore || 100} Pts</strong></span>
            <span>•</span>
            <span>Benchmark: <strong className="text-secondary">{Math.round((assignment?.maxScore || 100) * 0.7)} Pts</strong></span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary font-bold">Autograder CE</span>
          </div>
        </div>
      </section>

      {/* Notices */}
      {notice && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-900 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 3-PANE WORKBENCH CANVAS */}
      <div className="flex-1 grid grid-cols-12 gap-0 min-h-[calc(100vh-140px)] bg-surface">
        {/* ==========================================
            PANE 1: Submissions Queue (3 cols on lg)
            ========================================== */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3 bg-surface-container-lowest border-r border-surface-container flex flex-col h-full overflow-hidden">
          <div className="p-3 border-b border-surface-container bg-surface-container-low flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-secondary">view_list</span>
                <span>Submissions Queue</span>
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant font-bold">{filteredQueue.length}</span>
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5">
              {['all', 'pending', 'provisional', 'finalised'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`px-2 py-0.5 rounded-full capitalize font-medium transition-colors ${
                    queueFilter === f
                      ? 'bg-primary text-white'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  onClick={() => setQueueFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/20">
            {loading ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">Loading student queue…</div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">No submissions match filter.</div>
            ) : (
              filteredQueue.map((item) => {
                const isSelected = item.submissionId === selectedSubmissionId;
                return (
                  <button
                    key={item.submissionId}
                    type="button"
                    onClick={() => selectSubmission(item.submissionId)}
                    className={`w-full p-3 text-left transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-surface-container-high border-l-4 border-secondary'
                        : 'hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface truncate">{item.studentName}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                          item.status === 'finalised'
                            ? 'bg-green-100 text-green-900'
                            : item.status === 'reopened'
                            ? 'bg-blue-100 text-blue-900'
                            : item.status === 'provisionally_scored'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                      <span className="truncate max-w-[130px]">{item.studentEmail}</span>
                      <span className="font-bold text-primary">
                        {item.totalScore > 0 ? `${item.totalScore} Pts` : '—'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ==========================================
            PANE 2: Submission Inspection Tabs (5 cols on lg)
            ========================================== */}
        <main className="col-span-12 md:col-span-8 lg:col-span-5 bg-surface border-r border-surface-container flex flex-col h-full overflow-hidden">
          {activeLoading ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">Loading submission details…</div>
          ) : !submission ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">Select a student from the queue to inspect.</div>
          ) : (
            <>
              {/* Selected Student Header */}
              <div className="p-3.5 bg-surface-container-lowest border-b border-surface-container flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-primary">{activeData.grade?.studentName || 'Student'}</h3>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold">
                      {activeData.grade?.studentEmail || ''}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    <span>Submitted: {new Date(submission.submittedAt || submission.createdAt).toLocaleString()}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-primary-container text-white font-bold">
                    Final Snapshot
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
                    {submission.language}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                    submission.aiDeclaration?.aiUsed
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container text-on-surface'
                  }`}>
                    <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                    <span>
                      {submission.aiDeclaration?.aiUsed
                        ? `AI Declared: ${(submission.aiDeclaration.tools || []).join(', ') || 'Yes'}`
                        : 'No AI Used (Independent)'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center px-2 bg-surface-container-low border-b border-surface-container gap-1 overflow-x-auto text-xs">
                {[
                  { id: 'code', label: '1. Code Inspector' },
                  { id: 'tests', label: 'Test Results', badge: `${(submission.results || []).filter((r) => r.status === 'PASS').length}/${(submission.results || []).length || 0}` },
                  { id: 'disclosure', label: 'AI Disclosure' },
                  { id: 'logic', label: 'Logic Defense' },
                  { id: 'annotations', label: 'Annotations', badge: (submission.annotations || []).length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`px-3 py-2 font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-secondary border-b-2 border-secondary bg-surface-container-lowest font-bold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="font-mono text-[9px] px-1 rounded bg-surface-container text-on-surface font-semibold">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto bg-surface-container-lowest">
                {activeTab === 'code' && (
                  <div className="flex flex-col h-full">
                    {/* Header bar */}
                    <div className="h-8 px-3 bg-[#1E293B] border-b border-slate-700/50 flex items-center justify-between font-mono text-[11px] text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-teal-400">code</span>
                        <span className="text-white font-medium">Solution.{submission.language.includes('Java') ? 'java' : 'cpp'}</span>
                        <span className="text-slate-500">• {sourceLines.length} lines</span>
                      </div>
                      <button
                        type="button"
                        className="hover:text-white transition-colors flex items-center gap-1"
                        onClick={() => navigator.clipboard.writeText(submission.sourceCode || '')}
                        title="Copy source code"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        <span>Copy</span>
                      </button>
                    </div>

                    {/* Code lines */}
                    <div className="p-2 font-mono text-xs bg-[#0F172A] text-slate-200 overflow-x-auto leading-relaxed select-text flex-1">
                      {sourceLines.map((line, idx) => {
                        const lineNum = idx + 1;
                        const isAnnotated = annotatedLines.has(lineNum);
                        return (
                          <div key={lineNum} className={`flex hover:bg-white/5 ${isAnnotated ? 'bg-amber-950/40 text-amber-200' : ''}`}>
                            <span className={`w-9 text-right pr-3 select-none text-[11px] shrink-0 ${isAnnotated ? 'text-amber-500 font-bold' : 'text-slate-600'}`}>
                              {lineNum}
                            </span>
                            <span className="whitespace-pre pr-2">{line || ' '}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'tests' && (
                  <div className="p-4 flex flex-col gap-4">
                    <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-base">fact_check</span>
                          <span>Autograder Telemetry &amp; Sandbox Execution</span>
                        </span>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                          {(submission.results || []).filter((r) => r.status === 'PASS').length} / {(submission.results || []).length} Passed
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-mono">
                        Execution: <strong className="text-on-surface">{submission.executionTimeMs ?? 14} ms</strong> • Memory: <strong className="text-on-surface">{submission.memoryKb ?? 3400} KB</strong> • Status: <strong className="uppercase text-secondary">{submission.status}</strong>
                      </p>
                    </div>

                    {/* Test cases list */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Test Cases Breakdown</h4>
                      {(submission.results || []).length === 0 ? (
                        <div className="p-4 text-center text-xs text-on-surface-variant">No test case outputs recorded.</div>
                      ) : (
                        submission.results.map((res, i) => (
                          <div key={i} className="p-2.5 rounded-lg border border-outline-variant/30 bg-surface-container-low flex flex-col gap-1 text-xs font-mono">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-primary">Test Case #{i + 1}</span>
                              <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${res.status === 'PASS' ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
                                {res.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant mt-1">
                              <div><span className="text-slate-400">Input:</span> <code className="text-on-surface">{res.input}</code></div>
                              <div><span className="text-slate-400">Expected:</span> <code className="text-on-surface">{res.expectedOutput}</code></div>
                            </div>
                            {res.actualOutput && (
                              <div className="text-[11px] text-on-surface-variant">
                                <span className="text-slate-400">Actual:</span> <code className="text-on-surface">{res.actualOutput}</code>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'disclosure' && (
                  <div className="p-4 flex flex-col gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-2">
                      <span className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">verified_user</span>
                        <span>Constructive AI Disclosure Protocol</span>
                      </span>
                      <p className="text-on-surface-variant">
                        {submission.aiDeclaration?.aiUsed
                          ? 'Student explicitly declared utilizing generative AI tools during problem design and coding.'
                          : 'Student declared independent authoring with zero generative AI tool assistance.'}
                      </p>
                    </div>

                    {submission.aiDeclaration?.aiUsed && (
                      <div className="flex flex-col gap-2">
                        <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low">
                          <span className="font-bold text-primary block mb-1">Declared AI Tools</span>
                          <div className="flex flex-wrap gap-1">
                            {(submission.aiDeclaration.tools || []).map((t) => (
                              <span key={t} className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary text-xs font-mono font-medium">
                                {t}
                              </span>
                            ))}
                            {submission.aiDeclaration.otherTool && (
                              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-xs font-mono">
                                {submission.aiDeclaration.otherTool}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low">
                          <span className="font-bold text-primary block mb-1">Student Usage Narrative</span>
                          <p className="text-on-surface leading-relaxed whitespace-pre-wrap">
                            {submission.aiDeclaration.narrative || 'No additional narrative provided.'}
                          </p>
                        </div>

                        {studentAiLogs.length > 0 && (
                          <div className="p-3 rounded-lg border border-secondary/30 bg-surface-container-low flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-primary flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-secondary text-sm">psychology</span>
                                <span>In-Platform AI Assistant Inquiries ({studentAiLogs.length} logged)</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[10px] font-bold">
                                Verified Audit Log
                              </span>
                            </div>
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                              {studentAiLogs.map((log) => (
                                <div key={log.id} className="p-2.5 rounded-lg bg-white text-xs border border-outline-variant/30 flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-primary">
                                    <span className="uppercase text-secondary font-mono">[{log.mode}] Query: "{log.prompt}"</span>
                                    <span className="font-mono text-[10px] text-on-surface-variant">
                                      {new Date(log.createdAt).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-on-surface leading-relaxed whitespace-pre-wrap pt-0.5">
                                    {log.response?.slice(0, 200)}...
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'logic' && (
                  <div className="p-4 flex flex-col gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low">
                      <span className="font-bold text-primary block mb-1">1. Algorithmic Approach &amp; Core Invariants</span>
                      <p className="text-on-surface leading-relaxed whitespace-pre-wrap">
                        {submission.logicExplanation?.approach || 'No algorithmic approach defense filed.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low">
                      <span className="font-bold text-primary block mb-1">2. Data Structures &amp; Complexity Analysis</span>
                      <p className="text-on-surface leading-relaxed whitespace-pre-wrap">
                        {submission.logicExplanation?.dataStructures || 'No complexity justification filed.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low">
                      <span className="font-bold text-primary block mb-1">3. Trade-off Analysis &amp; Invariant Preservations</span>
                      <p className="text-on-surface leading-relaxed whitespace-pre-wrap">
                        {submission.logicExplanation?.tradeoffAnalysis || 'No trade-off analysis filed.'}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'annotations' && (
                  <div className="p-4 flex flex-col gap-3 text-xs">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                      Tagged AI-Assisted Code Regions ({(submission.annotations || []).length})
                    </h4>
                    {(submission.annotations || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-on-surface-variant">No code line annotations tagged.</div>
                    ) : (
                      submission.annotations.map((annot, i) => (
                        <div key={i} className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between font-mono font-bold">
                            <span>Lines {annot.startLine}–{annot.endLine}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px]">
                              {annot.modelUsed || 'AI Model'}
                            </span>
                          </div>
                          <p className="text-xs text-amber-950 leading-relaxed">
                            {annot.justification}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* ==========================================
            PANE 3: Rubric Evaluation & Marking (4 cols on lg)
            ========================================== */}
        <section className="col-span-12 lg:col-span-4 bg-surface-container-lowest flex flex-col h-full overflow-hidden border-t lg:border-t-0">
          <div className="p-3.5 border-b border-surface-container bg-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-base">rule</span>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Evaluation &amp; Rubric Scoring</span>
            </div>
            {/* Status indicator */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                isFinalised
                  ? 'bg-green-100 text-green-900'
                  : activeGrade?.status === 'reopened'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {isFinalised ? 'FINALISED' : 'PROVISIONAL'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Live Total Score Banner */}
            <div className="p-4 rounded-xl bg-primary text-white shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-slate-300 uppercase tracking-wider">Total Evaluated Score</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-extrabold">{totalScore}</span>
                  <span className="text-sm font-mono text-slate-300">/ {assignment?.maxScore || 100} Pts</span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  totalScore >= (assignment?.maxScore || 100) * 0.7
                    ? 'bg-green-400/20 text-green-200'
                    : 'bg-amber-400/20 text-amber-200'
                }`}>
                  {totalScore >= (assignment?.maxScore || 100) * 0.7 ? 'Meets Benchmark' : 'Review Viva'}
                </span>
                <span className="text-[10px] font-mono text-slate-400 mt-1">
                  {isFinalised ? 'Official Grade Saved' : 'Provisional Draft'}
                </span>
              </div>
            </div>

            {/* Rubric Components Input Sliders / Numbers */}
            <div className="flex flex-col gap-3.5">
              {/* Component 1: Correctness */}
              <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-primary">1. Automated Correctness</span>
                  <span className="font-mono font-bold text-secondary">{scores.correctness} / 40 Pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={scores.correctness}
                  disabled={isFinalised}
                  onChange={(e) => setScores((s) => ({ ...s, correctness: Number(e.target.value) }))}
                  className="w-full accent-secondary h-1.5 bg-surface-container-highest rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-on-surface-variant">
                  Calculated from Judge0 CE test passes with teacher override capability.
                </span>
              </div>

              {/* Component 2: Logic Defense */}
              <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-primary">2. Algorithmic Approach &amp; Invariants</span>
                  <span className="font-mono font-bold text-secondary">{scores.logic} / 30 Pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={scores.logic}
                  disabled={isFinalised}
                  onChange={(e) => setScores((s) => ({ ...s, logic: Number(e.target.value) }))}
                  className="w-full accent-secondary h-1.5 bg-surface-container-highest rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-on-surface-variant">
                  Evaluates algorithm choice, correctness justification, and edge cases.
                </span>
              </div>

              {/* Component 3: Complexity Justification */}
              <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-primary">3. Data Structures &amp; Complexity Bounds</span>
                  <span className="font-mono font-bold text-secondary">{scores.complexity} / 15 Pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={scores.complexity}
                  disabled={isFinalised}
                  onChange={(e) => setScores((s) => ({ ...s, complexity: Number(e.target.value) }))}
                  className="w-full accent-secondary h-1.5 bg-surface-container-highest rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-on-surface-variant">
                  Verification of amortized O(1) time/space and auxiliary memory bounds.
                </span>
              </div>

              {/* Component 4: AI Transparency & Viva Defense */}
              <div className="p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-primary">4. AI Transparency &amp; Viva Defense</span>
                  <span className="font-mono font-bold text-secondary">{scores.transparency} / 15 Pts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={scores.transparency}
                  disabled={isFinalised}
                  onChange={(e) => setScores((s) => ({ ...s, transparency: Number(e.target.value) }))}
                  className="w-full accent-secondary h-1.5 bg-surface-container-highest rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-on-surface-variant">
                  Non-punitive credit for honest tool disclosure, line annotations, and viva verification.
                </span>
              </div>
            </div>

            {/* Qualitative Feedback Textarea */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="teacher-feedback" className="text-xs font-bold text-primary">
                Qualitative Feedback for Student
              </label>
              <textarea
                id="teacher-feedback"
                rows="3"
                disabled={isFinalised}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Enter observations on algorithmic defense, memory leaks, and viva performance..."
                className="w-full p-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-secondary transition-colors"
              />
            </div>

            {/* Reopen Audit trail if present */}
            {activeGrade?.reopenReason && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                <span className="font-bold block">Reopen Audit Reason:</span>
                <span>{activeGrade.reopenReason}</span>
              </div>
            )}
          </div>

          {/* Action Buttons Footer */}
          <div className="p-3.5 border-t border-surface-container bg-surface-container-lowest flex items-center justify-between gap-2">
            {isFinalised ? (
              <button
                type="button"
                className="w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                onClick={() => setReopenModalOpen(true)}
              >
                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                <span>Reopen Evaluation</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors"
                  onClick={() => handleSave('provisionally_scored')}
                  disabled={isSaving}
                >
                  Save Provisional
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg bg-secondary hover:bg-secondary/90 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1"
                  onClick={() => handleSave('finalised')}
                  disabled={isSaving}
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Finalise Mark</span>
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Reopen Modal */}
      {reopenModalOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setReopenModalOpen(false); }}>
          <section className="assignment-dialog max-w-md p-6 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/40 flex flex-col gap-4" role="dialog" aria-modal="true">
            <h3 className="text-base font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary">lock_open</span>
              <span>Reopen Finalised Evaluation</span>
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Finalised grades are officially published to students. Reopening requires a recorded audit reason (e.g. viva moderation, rubric recalculation).
            </p>
            <form onSubmit={handleReopenSubmit} className="flex flex-col gap-3">
              <textarea
                required
                minLength={5}
                rows="3"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Enter mandatory audit reason for reopening..."
                className="w-full p-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-secondary"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-medium"
                  onClick={() => setReopenModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold shadow-sm"
                  disabled={isSaving || !reopenReason.trim()}
                >
                  Confirm Reopen
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

