import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function SimilarityReviewPage() {
  const { assignmentId, reportId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reports, setReports] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [activeReportLoading, setActiveReportLoading] = useState(false);

  // Parameter tuning
  const [threshold, setThreshold] = useState(75);
  const [evalNotes, setEvalNotes] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);

  // Selected report ID (either from route param, query param, or active index)
  const currentReportId = reportId || searchParams.get('reportId') || (reports[0]?.id ?? null);

  // Load similarity reports list
  const loadReports = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api(`/api/teacher/assignments/${assignmentId}/similarity?threshold=0&status=all`);
      setReports(res.reports || []);
      setAssignment(res.assignment || null);
    } catch (err) {
      setError(err.message || 'Failed to load similarity reports.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Load detailed report when currentReportId changes
  useEffect(() => {
    if (!currentReportId) {
      setActiveReport(null);
      return;
    }
    setActiveReportLoading(true);
    api(`/api/teacher/similarity/${currentReportId}`)
      .then((res) => {
        setActiveReport(res.report);
        setEvalNotes(res.report?.teacherNotes || '');
        if (res.report?.thresholdUsed) {
          setThreshold(res.report.thresholdUsed);
        }
      })
      .catch((err) => {
        setError(`Failed to load comparison: ${err.message}`);
      })
      .finally(() => {
        setActiveReportLoading(false);
      });
  }, [currentReportId]);

  // Navigate between pairs
  const currentIndex = useMemo(() => {
    if (!reports.length || !currentReportId) return -1;
    return reports.findIndex((r) => r.id === currentReportId);
  }, [reports, currentReportId]);

  const prevReport = currentIndex > 0 ? reports[currentIndex - 1] : null;
  const nextReport = currentIndex >= 0 && currentIndex < reports.length - 1 ? reports[currentIndex + 1] : null;

  function selectReport(id) {
    setSearchParams({ reportId: id });
  }

  // Trigger re-run
  async function triggerRun() {
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await api(`/api/teacher/assignments/${assignmentId}/similarity/run`, {
        method: 'POST',
        body: { threshold },
      });
      setNotice(`Similarity scan complete. Analyzed ${res.analyzedSubmissions} submissions, compared ${res.pairsCompared} pairs (${res.flaggedCount} flagged).`);
      await loadReports();
      if (res.reports?.length > 0) {
        selectReport(res.reports[0].id);
      }
    } catch (err) {
      setError(`Run failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Save teacher evaluation notes
  async function handleSaveNote() {
    if (!activeReport) return;
    setIsSavingNote(true);
    try {
      const res = await api(`/api/teacher/similarity/${activeReport.id}`, {
        method: 'PATCH',
        body: { teacherNotes: evalNotes },
      });
      setActiveReport(res.report);
      setNoteSavedNotice(true);
      setTimeout(() => setNoteSavedNotice(false), 2000);
    } catch (err) {
      setError(`Failed to save note: ${err.message}`);
    } finally {
      setIsSavingNote(false);
    }
  }

  // Update status (mark reviewed / ignore signal)
  async function handleUpdateStatus(newStatus) {
    if (!activeReport) return;
    try {
      const res = await api(`/api/teacher/similarity/${activeReport.id}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setActiveReport(res.report);
      setNotice(newStatus === 'reviewed' ? 'Signal marked as reviewed.' : 'Signal ignored/dismissed.');
      setTimeout(() => setNotice(''), 3000);
      // update list record in memory
      setReports((prev) => prev.map((r) => (r.id === res.report.id ? { ...r, status: newStatus } : r)));
    } catch (err) {
      setError(`Failed to update status: ${err.message}`);
    }
  }

  // Split code into lines for rendering
  const linesA = useMemo(() => {
    return (activeReport?.student1?.sourceCode || '').split('\n');
  }, [activeReport?.student1?.sourceCode]);

  const linesB = useMemo(() => {
    return (activeReport?.student2?.sourceCode || '').split('\n');
  }, [activeReport?.student2?.sourceCode]);

  // Determine line highlights from matchedSegments
  const highlightedLinesA = useMemo(() => {
    const map = new Map();
    if (!activeReport?.matchedSegments) return map;
    activeReport.matchedSegments.forEach((cluster) => {
      const [start, end] = cluster.subALines;
      for (let i = start; i <= end; i++) {
        map.set(i, cluster);
      }
    });
    return map;
  }, [activeReport?.matchedSegments]);

  const highlightedLinesB = useMemo(() => {
    const map = new Map();
    if (!activeReport?.matchedSegments) return map;
    activeReport.matchedSegments.forEach((cluster) => {
      const [start, end] = cluster.subBLines;
      for (let i = start; i <= end; i++) {
        map.set(i, cluster);
      }
    });
    return map;
  }, [activeReport?.matchedSegments]);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body-md text-on-surface">
      {/* Top Academic Context Bar */}
      <div className="w-full bg-surface-container-lowest px-6 py-4 shadow-sm border-b border-outline-variant/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Breadcrumb & Pair Identity */}
          <div className="flex flex-col gap-1 min-w-0">
            <nav className="flex items-center gap-1.5 text-xs text-on-surface-variant flex-wrap font-medium">
              <Link to="/teacher/assignments" className="hover:text-primary transition-colors">Courses</Link>
              <span className="material-symbols-outlined text-[13px] text-outline">chevron_right</span>
              <Link to="/teacher/assignments" className="hover:text-primary transition-colors">
                {assignment?.courseCode || 'CS301'}: {assignment?.title || 'Data Structures'}
              </Link>
              <span className="material-symbols-outlined text-[13px] text-outline">chevron_right</span>
              <span className="text-primary font-semibold">Similarity Flags</span>
              {activeReport && (
                <>
                  <span className="material-symbols-outlined text-[13px] text-outline">chevron_right</span>
                  <span className="font-mono text-xs font-semibold text-secondary px-2 py-0.5 rounded bg-surface-container">
                    Pair Analysis [{activeReport.student1?.name} ⇄ {activeReport.student2?.name}]
                  </span>
                </>
              )}
            </nav>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {activeReport ? (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  activeReport.similarityScore >= 75 ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                  <span>{activeReport.similarityScore}% Syntactic &amp; AST Overlap</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-bold">
                  <span className="material-symbols-outlined text-[16px]">difference</span>
                  <span>Pairwise Structural Analysis</span>
                </div>
              )}
              <span className="text-xs text-on-surface-variant max-w-2xl">
                Automated structural analysis signal. Intended for instructor review and viva inquiry, not an automated verdict of misconduct.
              </span>
            </div>
          </div>

          {/* Action Cluster & Pair Switchers */}
          <div className="flex items-center gap-2 flex-wrap lg:justify-end">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold transition-colors shadow-sm"
              onClick={triggerRun}
              disabled={loading}
            >
              <span className="material-symbols-outlined text-[16px]">autorenew</span>
              <span>{loading ? 'Scanning…' : 'Run Pairwise Scan'}</span>
            </button>

            {reports.length > 1 && (
              <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 shadow-sm border border-outline-variant/30">
                <button
                  type="button"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface transition-colors text-xs font-medium disabled:opacity-40"
                  onClick={() => prevReport && selectReport(prevReport.id)}
                  disabled={!prevReport}
                  title={prevReport ? `Previous: ${prevReport.studentAName} & ${prevReport.studentBName}` : 'No previous pair'}
                >
                  <span className="material-symbols-outlined text-[14px]">west</span>
                  <span className="hidden xl:inline">Prev Pair</span>
                </button>
                <div className="h-4 w-[1px] bg-outline-variant"></div>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface transition-colors text-xs font-medium disabled:opacity-40"
                  onClick={() => nextReport && selectReport(nextReport.id)}
                  disabled={!nextReport}
                  title={nextReport ? `Next: ${nextReport.studentAName} & ${nextReport.studentBName}` : 'No next pair'}
                >
                  <span className="hidden xl:inline">Next Pair</span>
                  <span className="material-symbols-outlined text-[14px]">east</span>
                </button>
              </div>
            )}

            {activeReport && (
              <>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors"
                  onClick={() => {
                    const el = document.getElementById('eval-notes-field');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.focus();
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>Add Note</span>
                </button>

                <button
                  type="button"
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeReport.status === 'dismissed'
                      ? 'bg-surface-container-highest text-on-surface'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                  }`}
                  onClick={() => handleUpdateStatus('dismissed')}
                  title="Dismiss signal as acceptable or benign"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                  <span>Ignore Signal</span>
                </button>

                <button
                  type="button"
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                    activeReport.status === 'reviewed'
                      ? 'bg-green-700 text-white'
                      : 'bg-secondary hover:bg-secondary/90 text-white'
                  }`}
                  onClick={() => handleUpdateStatus('reviewed')}
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{activeReport.status === 'reviewed' ? 'Reviewed' : 'Mark as Reviewed'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Notices and Alerts */}
        {notice && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Parameter Tuning Matrix & Method Signature */}
        <div className="mt-3 bg-surface-container-low rounded-xl px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-4 border border-outline-variant/20">
          {/* Threshold Slider */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
              <span className="text-xs font-semibold text-on-surface whitespace-nowrap">AST Sensitivity Threshold:</span>
              <span className="font-mono text-xs font-bold text-secondary bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm">
                {threshold}%
              </span>
            </div>
            <div className="flex flex-col w-48 sm:w-64">
              <input
                className="w-full accent-secondary bg-surface-container-highest h-1.5 rounded-lg appearance-none cursor-pointer"
                max="95"
                min="50"
                step="5"
                type="range"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <div className="flex justify-between text-[9px] font-mono text-outline mt-1 px-0.5">
                <span>50%</span>
                <span>65%</span>
                <span className="font-bold text-secondary">75%</span>
                <span>85%</span>
                <span>95%</span>
              </div>
            </div>
          </div>

          {/* Quick Inspection Metrics */}
          {activeReport && (
            <div className="flex items-center gap-3 flex-wrap text-on-surface-variant font-mono text-xs w-full md:w-auto justify-end">
              <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded shadow-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-[14px] text-secondary">account_tree</span>
                <span>
                  Matched Nodes: <strong className="text-on-surface">{activeReport.metrics?.matchedNodes?.matched ?? 0} / {activeReport.metrics?.matchedNodes?.total ?? 0}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded shadow-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-[14px] text-secondary">view_carousel</span>
                <span>
                  Clusters: <strong className="text-on-surface">{activeReport.matchedSegments?.length || 0} Blocks</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded shadow-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-[14px] text-primary">psychology</span>
                <span>
                  Engine: <span className="text-on-surface">{activeReport.metrics?.engine || 'Tree Edit Distance & Winnowing'}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 lg:p-6 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">
        {loading && !activeReport ? (
          <div className="p-12 text-center text-sm text-on-surface-variant">Loading similarity inspection workbench…</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-secondary">difference</span>
            <h3 className="text-base font-bold text-on-surface">No Similarity Comparisons Available</h3>
            <p className="text-xs text-on-surface-variant max-w-md">
              Run a pairwise similarity scan across all final student submissions for this assignment to calculate syntactic and AST token overlap.
            </p>
            <button
              type="button"
              className="mt-2 primary-button text-xs"
              onClick={triggerRun}
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              <span>Run Initial Pairwise Scan</span>
            </button>
          </div>
        ) : activeReportLoading ? (
          <div className="p-12 text-center text-sm text-on-surface-variant">Loading pair details…</div>
        ) : activeReport ? (
          <>
            {/* Dual Split-Pane Code Comparison Workbench */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
              {/* LEFT PANEL: Student 1 */}
              <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
                {/* Header */}
                <div className="bg-[#03224D] text-white p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] bg-[#1F3864] px-2 py-0.5 rounded text-[#98f0fb] font-bold tracking-wider">
                        STUDENT 1
                      </span>
                      <span className="text-sm font-bold text-white tracking-tight">
                        {activeReport.student1?.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-white/10 text-white px-2 py-0.5 rounded">
                      Final Submission
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-300 pt-1 bg-white/5 p-2 rounded-lg">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Email</span>
                      <span className="text-white truncate block">{activeReport.student1?.email}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Language</span>
                      <span className="text-[#98f0fb]">{activeReport.student1?.language}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Submitted</span>
                      <span className="text-white">
                        {activeReport.student1?.submittedAt ? new Date(activeReport.student1.submittedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-3 flex items-center gap-1.5 text-[#98f0fb] pt-0.5 truncate">
                      <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                      <span className="truncate">
                        Declared AI:{' '}
                        <strong>
                          {activeReport.student1?.aiDeclaration?.aiUsed
                            ? (activeReport.student1.aiDeclaration.tools || []).join(', ') || 'Declared'
                            : 'No AI Used (Independent)'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* File Header */}
                <div className="bg-surface-container px-3 py-1.5 flex items-center justify-between border-b border-outline-variant/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-secondary">description</span>
                    <span className="font-mono font-bold text-on-surface">Solution.{activeReport.student1?.language?.includes('Java') ? 'java' : 'cpp'}</span>
                    <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-high px-1 rounded">
                      {linesA.length} lines
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-[11px]"
                    onClick={() => navigator.clipboard.writeText(activeReport.student1?.sourceCode || '')}
                    title="Copy code"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>Copy</span>
                  </button>
                </div>

                {/* Code Viewer 1 */}
                <div className="font-mono text-xs bg-[#1b2336] text-slate-200 overflow-x-auto p-2 leading-relaxed max-h-[500px] overflow-y-auto">
                  <div className="min-w-[500px]">
                    {linesA.map((line, idx) => {
                      const lineNum = idx + 1;
                      const cluster = highlightedLinesA.get(lineNum);
                      const isClusterStart = cluster && cluster.subALines[0] === lineNum;
                      return (
                        <div key={lineNum}>
                          {isClusterStart && (
                            <div className="bg-[#1F3864]/90 text-[#98f0fb] px-2.5 py-0.5 my-1 rounded flex items-center justify-between text-[10px] font-mono border border-secondary/30 shadow-sm">
                              <span className="flex items-center gap-1 font-semibold truncate">
                                <span className="material-symbols-outlined text-[12px]">bolt</span>
                                <span>{cluster.label}</span>
                              </span>
                              <span className="text-[9px] text-slate-300">AST Match: {cluster.score}</span>
                            </div>
                          )}
                          <div className={`flex hover:bg-white/5 ${cluster ? 'bg-[#1F3864]/60 text-white font-medium' : 'text-slate-300'}`}>
                            <span className="w-10 text-right pr-3 select-none text-slate-500 text-[11px] shrink-0">
                              {lineNum}
                            </span>
                            <span className="whitespace-pre font-mono pr-2">{line || ' '}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: Student 2 */}
              <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
                {/* Header */}
                <div className="bg-[#03224D] text-white p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] bg-[#1F3864] px-2 py-0.5 rounded text-[#98f0fb] font-bold tracking-wider">
                        STUDENT 2
                      </span>
                      <span className="text-sm font-bold text-white tracking-tight">
                        {activeReport.student2?.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-white/10 text-white px-2 py-0.5 rounded">
                      Final Submission
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-300 pt-1 bg-white/5 p-2 rounded-lg">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Email</span>
                      <span className="text-white truncate block">{activeReport.student2?.email}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Language</span>
                      <span className="text-[#98f0fb]">{activeReport.student2?.language}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Submitted</span>
                      <span className="text-white">
                        {activeReport.student2?.submittedAt ? new Date(activeReport.student2.submittedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-3 flex items-center gap-1.5 text-[#98f0fb] pt-0.5 truncate">
                      <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                      <span className="truncate">
                        Declared AI:{' '}
                        <strong>
                          {activeReport.student2?.aiDeclaration?.aiUsed
                            ? (activeReport.student2.aiDeclaration.tools || []).join(', ') || 'Declared'
                            : 'No AI Used (Independent)'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* File Header */}
                <div className="bg-surface-container px-3 py-1.5 flex items-center justify-between border-b border-outline-variant/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-secondary">description</span>
                    <span className="font-mono font-bold text-on-surface">Solution.{activeReport.student2?.language?.includes('Java') ? 'java' : 'cpp'}</span>
                    <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-high px-1 rounded">
                      {linesB.length} lines
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-[11px]"
                    onClick={() => navigator.clipboard.writeText(activeReport.student2?.sourceCode || '')}
                    title="Copy code"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>Copy</span>
                  </button>
                </div>

                {/* Code Viewer 2 */}
                <div className="font-mono text-xs bg-[#1b2336] text-slate-200 overflow-x-auto p-2 leading-relaxed max-h-[500px] overflow-y-auto">
                  <div className="min-w-[500px]">
                    {linesB.map((line, idx) => {
                      const lineNum = idx + 1;
                      const cluster = highlightedLinesB.get(lineNum);
                      const isClusterStart = cluster && cluster.subBLines[0] === lineNum;
                      return (
                        <div key={lineNum}>
                          {isClusterStart && (
                            <div className="bg-[#1F3864]/90 text-[#98f0fb] px-2.5 py-0.5 my-1 rounded flex items-center justify-between text-[10px] font-mono border border-secondary/30 shadow-sm">
                              <span className="flex items-center gap-1 font-semibold truncate">
                                <span className="material-symbols-outlined text-[12px]">bolt</span>
                                <span>{cluster.label}</span>
                              </span>
                              <span className="text-[9px] text-slate-300">AST Match: {cluster.score}</span>
                            </div>
                          )}
                          <div className={`flex hover:bg-white/5 ${cluster ? 'bg-[#1F3864]/60 text-white font-medium' : 'text-slate-300'}`}>
                            <span className="w-10 text-right pr-3 select-none text-slate-500 text-[11px] shrink-0">
                              {lineNum}
                            </span>
                            <span className="whitespace-pre font-mono pr-2">{line || ' '}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Analysis Summary & Evaluator Observation Deck */}
            <div className="flex flex-col gap-4">
              {/* Contextual Guidance Notice */}
              <div className="rounded-xl bg-surface-container-high p-4 flex items-start gap-3 shadow-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-[20px] text-secondary mt-0.5">info</span>
                <div className="flex flex-col gap-0.5 text-on-surface">
                  <span className="text-sm font-bold">Oral Examination Recommendation</span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Compare both students' declarations and logic explanations. Check viva defense oral transcripts to confirm independent conceptual understanding of memory management, pointer de-referencing safety, and algorithm complexity.
                  </p>
                </div>
              </div>

              {/* Comparison Metrics & Notes Deck */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Structural Equivalence Card (5 cols) */}
                <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-3 bg-surface-container-low px-3 py-2 rounded-lg">
                      <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Structural Equivalence</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-container-highest text-secondary">
                        SYNTACTIC DEEP-SCAN
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col">
                        <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">Token Sim.</span>
                        <span className="text-lg font-bold text-on-surface mt-1">{activeReport.tokenSimilarity}%</span>
                        <span className="text-[10px] text-secondary mt-0.5">Winnowing (k=5)</span>
                      </div>
                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col">
                        <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">AST Isomorphism</span>
                        <span className="text-lg font-bold text-on-surface mt-1">{activeReport.astIsomorphism}%</span>
                        <span className="text-[10px] text-secondary mt-0.5">Tree Distance</span>
                      </div>
                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col">
                        <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">Var Renaming</span>
                        <span className="text-lg font-bold text-primary mt-1">{activeReport.metrics?.varRenaming || 'Alpha-converted'}</span>
                        <span className="text-[10px] text-on-surface-variant mt-0.5">Structure-aware</span>
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-surface-container-low flex flex-col gap-1.5 text-xs text-on-surface-variant">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-on-surface">Control Flow Graph Divergence</span>
                        <span className="font-mono font-bold text-on-surface">
                          {activeReport.metrics?.cfgDivergence ?? 0.08}
                        </span>
                      </div>
                      <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-secondary h-full rounded-full transition-all"
                          style={{ width: `${Math.max(10, Math.min(100, Math.round((1 - (activeReport.metrics?.cfgDivergence ?? 0.08)) * 100)))}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-outline mt-0.5">
                        Normalized statement sequence matches across core algorithms and routines.
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 text-[10px] font-mono text-outline flex items-center justify-between border-t border-outline-variant/30 mt-3">
                    <span>Engine: <code className="text-on-surface font-semibold">{activeReport.metrics?.engine || 'winnow-cxx20'}</code></span>
                    <span>Status: <strong className="uppercase text-secondary">{activeReport.status}</strong></span>
                  </div>
                </div>

                {/* Instructor Observation & Notes Card (7 cols) */}
                <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-secondary">rate_review</span>
                        <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                          Instructor Evaluation Notes &amp; Viva Prompts
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                        Confidential to Faculty
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Record neutral inquiries or verified outcomes from the code viva. These logs become part of the official departmental moderation trail.
                    </p>
                    <div className="mt-1">
                      <textarea
                        className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface text-xs font-body-md placeholder:text-outline border border-outline-variant/30 focus:outline-none focus:border-secondary transition-all"
                        id="eval-notes-field"
                        placeholder="Enter neutral evaluative observations for oral examination / record (e.g. Inquired about head/tail dummy node memory deallocation during class destructor call; student explained eviction cycle adequately)..."
                        rows="4"
                        value={evalNotes}
                        onChange={(e) => setEvalNotes(e.target.value)}
                      ></textarea>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/30 mt-2">
                    <div className="flex items-center gap-2 text-outline text-xs">
                      <span className="material-symbols-outlined text-[15px]">history</span>
                      <span>
                        {noteSavedNotice ? (
                          <strong className="text-green-700">Note saved successfully!</strong>
                        ) : activeReport.updatedAt ? (
                          `Last modified ${new Date(activeReport.updatedAt).toLocaleTimeString()}`
                        ) : (
                          'Ready for notes'
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors"
                        onClick={() => setEvalNotes('')}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/90 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                      >
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>{isSavingNote ? 'Saving…' : 'Save Note'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

