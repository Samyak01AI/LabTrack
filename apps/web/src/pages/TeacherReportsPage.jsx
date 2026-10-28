import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function TeacherReportsPage() {
  const { assignmentId: paramAssignmentId } = useParams();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(paramAssignmentId || '');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');

  // Reporting payload
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [roster, setRoster] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all'); // 'all', 'finalised', 'pending', 'flagged'
  const [bracketFilter, setBracketFilter] = useState('all'); // 'all', 'distinction', 'competent', 'at_risk'
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Student breakdown modal
  const [breakdownStudent, setBreakdownStudent] = useState(null);

  // 1. Fetch teacher assignments
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/teacher/assignments');
      const list = res.assignments || [];
      setAssignments(list);

      if (list.length > 0) {
        if (paramAssignmentId && list.some((a) => a.id === paramAssignmentId)) {
          setSelectedAssignmentId(paramAssignmentId);
        } else if (!selectedAssignmentId) {
          setSelectedAssignmentId(list[0].id);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load teacher assignments.');
    } finally {
      setLoading(false);
    }
  }, [paramAssignmentId, selectedAssignmentId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // 2. Fetch cohort metrics & roster whenever selected assignment changes
  const loadReportsData = useCallback(async (targetId) => {
    if (!targetId) return;
    setDataLoading(true);
    setError('');
    try {
      const [metricsRes, resultsRes] = await Promise.all([
        api(`/api/teacher/assignments/${targetId}/cohort-metrics`),
        api(`/api/teacher/assignments/${targetId}/cohort-results`),
      ]);

      setAssignmentInfo(metricsRes.assignment || resultsRes.assignment || null);
      setMetrics(metricsRes.metrics || null);
      setRoster(resultsRes.roster || []);
      setSelectedRows(new Set());
    } catch (err) {
      setError(err.message || 'Failed to load cohort reports for this assignment.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAssignmentId) {
      loadReportsData(selectedAssignmentId);
    }
  }, [selectedAssignmentId, loadReportsData]);

  // Handle assignment select change
  const handleAssignmentChange = (e) => {
    const newId = e.target.value;
    setSelectedAssignmentId(newId);
    navigate(`/teacher/assignments/${newId}/reports`);
  };

  // Helper letter grade & bracket
  const getLetterGrade = (score, max = 100) => {
    if (score == null) return 'N/A';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 85) return 'A';
    if (pct >= 80) return 'A-';
    if (pct >= 75) return 'B+';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    return 'F';
  };

  // Filtered roster
  const filteredRoster = useMemo(() => {
    return roster.filter((student) => {
      // Evaluation state
      if (stateFilter === 'finalised' && student.grade?.status !== 'finalised') return false;
      if (stateFilter === 'pending' && student.grade?.status === 'finalised') return false;
      if (stateFilter === 'flagged' && !student.isFlagged) return false;

      // Score bracket
      const finalScore = student.grade?.totalScore;
      if (bracketFilter === 'distinction') {
        if (finalScore == null || finalScore < 90) return false;
      } else if (bracketFilter === 'competent') {
        if (finalScore == null || finalScore < 70 || finalScore >= 90) return false;
      } else if (bracketFilter === 'at_risk') {
        if (finalScore == null || finalScore >= 70) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          student.studentName?.toLowerCase().includes(q) ||
          student.studentEmail?.toLowerCase().includes(q) ||
          student.studentId?.toLowerCase().includes(q) ||
          student.submissionId?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [roster, stateFilter, bracketFilter, searchQuery]);

  // Row selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(new Set(filteredRoster.map((s) => s.submissionId)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const toggleRowSelect = (subId) => {
    const next = new Set(selectedRows);
    if (next.has(subId)) {
      next.delete(subId);
    } else {
      next.add(subId);
    }
    setSelectedRows(next);
  };

  // Derived averages for KPI cards
  const evaluatedList = roster.filter((r) => r.grade?.totalScore != null);
  const avgCorrectness = evaluatedList.length > 0
    ? (evaluatedList.reduce((acc, r) => acc + (r.grade.correctnessScore || 0), 0) / evaluatedList.length).toFixed(1)
    : '0.0';
  const avgVivaLogic = evaluatedList.length > 0
    ? (evaluatedList.reduce((acc, r) => acc + (r.grade.logicScore || 0), 0) / evaluatedList.length).toFixed(1)
    : '0.0';

  // GPA calculation estimate
  const gpaEstimate = metrics && metrics.mean > 0
    ? Math.min(4.0, (metrics.mean / 25).toFixed(2))
    : '0.00';

  // Find max bin count for histogram height scaling
  const maxBinCount = metrics?.distribution
    ? Math.max(...metrics.distribution.map((b) => b.count), 1)
    : 1;

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 lg:px-8 py-6 text-on-surface">
      {/* Printable Institutional Header (visible only on print) */}
      <div className="hidden print:block mb-6 border-b-2 border-primary pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-primary">Department of Computer Science &amp; Engineering</h1>
            <p className="text-sm font-semibold text-on-surface">Course Evaluation Ledger &amp; Academic Cohort Report</p>
          </div>
          <div className="text-right text-xs text-on-surface-variant font-mono">
            <p>LabTrack Academic Engine v0.8.0</p>
            <p>Generated: {new Date().toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-6 text-xs text-on-surface font-mono">
          <span><strong>Course:</strong> {assignmentInfo?.courseCode || 'CS301'}</span>
          <span><strong>Assignment:</strong> {assignmentInfo?.assignmentCode} - {assignmentInfo?.title}</span>
          <span><strong>Cohort Sample:</strong> N = {roster.length}</span>
          <span><strong>Class Avg:</strong> {metrics?.mean ?? 'N/A'}%</span>
          <span><strong>Median:</strong> {metrics?.median ?? 'N/A'}%</span>
        </div>
      </div>

      {/* Screen Academic Header & Action Toolbar */}
      <div className="pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-outline-variant/30 print:hidden">
        <div className="flex flex-col gap-1.5 max-w-3xl">
          <div className="flex items-center gap-1.5 font-mono text-xs text-on-surface-variant">
            <Link to="/teacher/assignments" className="hover:text-primary transition-colors">Courses</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="hover:text-primary transition-colors">{assignmentInfo?.courseCode || 'CS301'}</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-secondary font-semibold">Results &amp; Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Course Evaluation Ledger &amp; Performance Reports
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            Cohort assessment metrics, automated test benchmarks, viva defense outcomes, and grade exports for {assignmentInfo?.courseCode || 'CS301'}.
          </p>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {selectedAssignmentId && (
            <a
              href={`/api/teacher/assignments/${selectedAssignmentId}/export/csv`}
              download={`${assignmentInfo?.assignmentCode || 'cohort'}_results.csv`}
              className="h-9 px-3.5 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Download RFC 4180 compliant CSV ledger"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">download</span>
              <span>Export CSV</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">print</span>
            <span>Print / PDF</span>
          </button>
          {selectedAssignmentId && (
            <Link
              to={`/teacher/assignments/${selectedAssignmentId}/marking`}
              className="h-9 px-3.5 rounded-lg bg-secondary text-white hover:bg-secondary/90 text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Marking Workbench</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Analytics & KPI Distribution Overview Bento */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Histogram Chart Visual Container (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-xl p-5 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">bar_chart</span>
                <h2 className="text-base font-bold text-on-surface">Cohort Final Mark Distribution</h2>
              </div>
              <p className="font-mono text-xs text-on-surface-variant mt-0.5">
                Sample size: N = {roster.length} Submissions • Target μ = 80.0%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] text-on-surface">
                <span className="w-2 h-2 rounded-full bg-secondary"></span> Actual
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] text-on-surface">
                <span className="w-3 h-0.5 bg-red-500"></span> Threshold (60)
              </span>
            </div>
          </div>

          {/* SVG/CSS Histogram & Benchmark Lines */}
          <div className="relative w-full h-44 flex flex-col justify-end pt-3">
            {/* Background Benchmark Lines */}
            <div className="absolute inset-x-0 top-6 border-b border-dashed border-outline-variant/30 flex justify-end">
              <span className="font-mono text-[10px] text-on-surface-variant -mt-3.5 bg-white px-1">
                Top Quartile (80%)
              </span>
            </div>
            <div className="absolute inset-x-0 top-20 border-b border-dashed border-outline-variant/20 flex justify-end">
              <span className="font-mono text-[10px] text-on-surface-variant -mt-3.5 bg-white px-1">
                Median ({metrics?.median ?? '0.0'}%)
              </span>
            </div>

            {/* Vertical Bars Grid */}
            <div className="grid grid-cols-5 gap-3 items-end h-32 w-full z-10 px-2">
              {metrics?.distribution?.map((bin, idx) => {
                const count = bin.count;
                const pct = bin.percentage;
                const heightPct = maxBinCount > 0 ? Math.max(12, Math.round((count / maxBinCount) * 95)) : 12;
                const isFail = bin.interval === '<60';
                const isPeak = count === maxBinCount && count > 0;

                return (
                  <div key={bin.interval} className="flex flex-col items-center gap-1 group cursor-pointer">
                    <span className={`font-mono text-[10px] ${isPeak ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
                      {count} ({pct}%)
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all relative flex items-end justify-center ${
                        isFail
                          ? 'bg-red-100 hover:bg-red-200 text-red-600'
                          : isPeak
                          ? 'bg-secondary hover:bg-secondary/90 text-white'
                          : 'bg-teal-100 hover:bg-teal-200 text-secondary'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${bin.interval} (${bin.label}): ${count} students (${pct}%)`}
                    >
                      <div className={`w-full h-1 rounded-t ${isFail ? 'bg-red-500' : 'bg-secondary'}`}></div>
                      {isPeak && (
                        <span className="material-symbols-outlined text-white text-[13px] mb-1 absolute top-1">
                          star
                        </span>
                      )}
                    </div>
                    <span className={`font-mono text-[10px] truncate ${isFail ? 'text-red-600 font-medium' : isPeak ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
                      {bin.interval}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inline Secondary Stats Band */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 mt-3 border-t border-outline-variant/20 bg-surface-container-low/60 p-3 rounded-lg">
            <div className="flex flex-col">
              <span className="font-mono text-[11px] text-on-surface-variant">Class Average</span>
              <span className="text-base font-bold text-on-surface">{metrics?.mean ?? '0.0'}%</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[11px] text-on-surface-variant">Median</span>
              <span className="text-base font-bold text-secondary">{metrics?.median ?? '0.0'}%</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[11px] text-on-surface-variant">Pass Rate</span>
              <span className="text-base font-bold text-on-surface">{metrics?.passRate ?? '0.0'}%</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[11px] text-on-surface-variant">Disclosed AI</span>
              <span className="text-base font-bold text-on-surface">{metrics?.aiDeclarationRate ?? '0.0'}%</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[11px] text-red-600">Flags Audit</span>
              <div className="flex items-center gap-1 text-red-600">
                <span className="material-symbols-outlined text-[15px]">flag</span>
                <span className="text-base font-bold">
                  {roster.filter((r) => r.isFlagged).length} Open
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Performance Cards Matrix (5 cols) */}
        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Submissions */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Enrolled</span>
              <span className="material-symbols-outlined text-[18px]">groups</span>
            </div>
            <div className="my-2">
              <div className="text-3xl font-extrabold text-primary">{roster.length}</div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                {assignmentInfo?.courseCode || 'CS301'} Active Roster
              </div>
            </div>
            <div className="flex items-center gap-1 text-secondary font-mono text-[11px]">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>100% Roster Validated</span>
            </div>
          </div>

          {/* Submissions Evaluated */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] font-bold uppercase tracking-wider">Evaluated</span>
              <span className="material-symbols-outlined text-[18px]">grading</span>
            </div>
            <div className="my-2">
              <div className="text-3xl font-extrabold text-on-surface">
                {evaluatedList.length}
                <span className="text-sm text-on-surface-variant font-normal"> / {roster.length}</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all"
                  style={{ width: `${roster.length > 0 ? (evaluatedList.length / roster.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
              <span>Progress: {roster.length > 0 ? ((evaluatedList.length / roster.length) * 100).toFixed(1) : 0}%</span>
              <span className="text-amber-600 font-medium">{roster.length - evaluatedList.length} pending</span>
            </div>
          </div>

          {/* Avg Correctness Score */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Correctness</span>
              <span className="material-symbols-outlined text-[18px]">bug_report</span>
            </div>
            <div className="my-2">
              <div className="text-3xl font-extrabold text-on-surface">
                {avgCorrectness}
                <span className="text-sm text-on-surface-variant font-normal"> / 40</span>
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">Automated test harness</div>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] w-fit">
              <span>Harness Component</span>
            </div>
          </div>

          {/* Avg Viva Defense Score */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Viva Defense</span>
              <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
            </div>
            <div className="my-2">
              <div className="text-3xl font-extrabold text-on-surface">
                {avgVivaLogic}
                <span className="text-sm text-on-surface-variant font-normal"> / 30</span>
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">Conceptual logic defense</div>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] w-fit">
              <span>Rubric Component</span>
            </div>
          </div>

          {/* Cohort GPA Impact Banner */}
          <div className="sm:col-span-2 bg-[#1f3864] text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-white shrink-0">
                <span className="material-symbols-outlined text-[24px]">trending_up</span>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  Cohort Normalized GPA Projection
                </div>
                <div className="text-2xl font-bold text-white">
                  {gpaEstimate} <span className="text-xs font-normal text-teal-200">/ 4.00 Cumulative</span>
                </div>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="font-mono text-xs text-teal-200 font-semibold">Standard 4.0 Scale</div>
              <div className="font-mono text-[10px] text-blue-200 mt-0.5">Linear Normalization</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Control Workbench */}
      <div className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Assignment Selector */}
          <div className="lg:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Assignment Target
            </label>
            <div className="relative">
              <select
                value={selectedAssignmentId}
                onChange={handleAssignmentChange}
                className="w-full h-9 pl-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold focus:ring-2 focus:ring-secondary outline-none appearance-none cursor-pointer"
              >
                {assignments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.assignmentCode}: {item.title}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2 text-on-surface-variant pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Evaluation State
            </label>
            <div className="relative">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full h-9 pl-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs focus:ring-2 focus:ring-secondary outline-none appearance-none cursor-pointer"
              >
                <option value="all">All Submissions ({roster.length})</option>
                <option value="finalised">Graded &amp; Finalised ({evaluatedList.length})</option>
                <option value="pending">Pending Evaluation ({roster.length - evaluatedList.length})</option>
                <option value="flagged">Flagged for Similarity ({roster.filter((r) => r.isFlagged).length})</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2 text-on-surface-variant pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Score Range Filter */}
          <div className="lg:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Score Bracket
            </label>
            <div className="relative">
              <select
                value={bracketFilter}
                onChange={(e) => setBracketFilter(e.target.value)}
                className="w-full h-9 pl-3 pr-8 rounded-lg bg-surface-container-low text-on-surface text-xs focus:ring-2 focus:ring-secondary outline-none appearance-none cursor-pointer"
              >
                <option value="all">All Scores (&gt;0)</option>
                <option value="distinction">Distinction (≥90)</option>
                <option value="competent">Competent (70–89)</option>
                <option value="at_risk">At Risk (&lt;70)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2 text-on-surface-variant pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="lg:col-span-3 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Quick Search
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Student name, roll no., or ID..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 text-xs focus:ring-2 focus:ring-secondary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-on-surface-variant">Active Filters:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[11px]">
              {assignmentInfo?.assignmentCode || 'Assignment'}
            </span>
            {stateFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container font-mono text-[11px] text-on-surface">
                State: {stateFilter}
                <button type="button" onClick={() => setStateFilter('all')} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              </span>
            )}
            {bracketFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container font-mono text-[11px] text-on-surface">
                Bracket: {bracketFilter}
                <button type="button" onClick={() => setBracketFilter('all')} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              </span>
            )}
            {(stateFilter !== 'all' || bracketFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStateFilter('all');
                  setBracketFilter('all');
                  setSearchQuery('');
                }}
                className="font-mono text-xs text-secondary hover:underline ml-1"
              >
                Reset Filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[15px]">sync</span>
            <span>Live audit ledger synchronized</span>
          </div>
        </div>
      </div>

      {/* Comprehensive Results Ledger Table */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
        {/* Table Top Meta Header */}
        <div className="px-5 py-3 bg-surface-container-low flex items-center justify-between gap-4 border-b border-outline-variant/30 print:hidden">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={filteredRoster.length > 0 && selectedRows.size === filteredRoster.length}
                className="rounded text-secondary focus:ring-secondary h-4 w-4"
              />
              <span>Select All Visible ({filteredRoster.length})</span>
            </label>
            <span className="text-outline-variant">•</span>
            <span className="font-mono text-xs text-on-surface-variant">
              Sorted by: <span className="font-semibold text-on-surface">Final Mark (Descending)</span>
            </span>
          </div>
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-secondary font-semibold">
                {selectedRows.size} selected
              </span>
            </div>
          )}
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {dataLoading ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">
              Loading cohort evaluation records…
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">
              No student submissions match the active filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/70 text-on-surface-variant text-[11px] font-bold border-b border-outline-variant/30 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center print:hidden">#</th>
                  <th className="py-3 px-4">Student ID / Roll</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Submission Status</th>
                  <th className="py-3 px-4 text-right">Correctness (40)</th>
                  <th className="py-3 px-4 text-right">Understanding (30)</th>
                  <th className="py-3 px-4 text-right">Final Mark</th>
                  <th className="py-3 px-4 text-center">Integrity Audit</th>
                  <th className="py-3 px-4 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-xs">
                {filteredRoster.map((student, idx) => {
                  const isSelected = selectedRows.has(student.submissionId);
                  const isGraded = student.grade?.status === 'finalised';
                  const isProvisional = student.grade?.status === 'provisional';
                  const isHold = student.isFlagged;
                  const totalScore = student.grade?.totalScore;
                  const letter = getLetterGrade(totalScore, assignmentInfo?.maxScore || 100);

                  // Extract student initials
                  const nameParts = (student.studentName || 'Student').split(' ');
                  const initials = nameParts.length > 1
                    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
                    : nameParts[0].slice(0, 2).toUpperCase();

                  return (
                    <tr
                      key={student.submissionId || student.studentId || idx}
                      className={`hover:bg-surface-container-low/50 transition-colors ${
                        isHold ? 'bg-red-50/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center print:hidden">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelect(student.submissionId)}
                          className="rounded text-secondary focus:ring-secondary h-4 w-4"
                        />
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-primary">
                        {student.studentId?.slice(0, 8).toUpperCase() || `STU-${idx + 1}`}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] ${
                            isHold ? 'bg-red-600 text-white' : 'bg-secondary text-white'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <div className={`font-semibold text-xs ${isHold ? 'text-red-700' : 'text-on-surface'}`}>
                              {student.studentName}
                            </div>
                            <div className="font-mono text-[10px] text-on-surface-variant">
                              {student.studentEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            <span>Graded &amp; Signed</span>
                          </span>
                        ) : isProvisional ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                            <span className="material-symbols-outlined text-[13px]">pending</span>
                            <span>Provisional</span>
                          </span>
                        ) : isHold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-semibold">
                            <span className="material-symbols-outlined text-[13px]">shield</span>
                            <span>Under Review</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[11px] font-semibold">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            <span>Pending Review</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-on-surface">
                        {student.grade?.correctnessScore != null ? (
                          <>
                            {student.grade.correctnessScore.toFixed(1)}{' '}
                            <span className="text-on-surface-variant text-[10px] font-normal">/ 40</span>
                          </>
                        ) : (
                          <span className="text-on-surface-variant italic font-normal">--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-on-surface">
                        {student.grade?.logicScore != null ? (
                          <>
                            {student.grade.logicScore.toFixed(1)}{' '}
                            <span className="text-on-surface-variant text-[10px] font-normal">/ 30</span>
                          </>
                        ) : (
                          <span className="text-on-surface-variant italic font-normal">--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {totalScore != null ? (
                          <div className="inline-flex items-center gap-1.5 font-mono font-bold text-on-surface">
                            <span>{totalScore} / {assignmentInfo?.maxScore || 100}</span>
                            <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-secondary text-[10px] font-bold">
                              {letter}
                            </span>
                          </div>
                        ) : isHold ? (
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-red-600">
                            <span>[HOLD]</span>
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px]">INC</span>
                          </div>
                        ) : (
                          <span className="font-mono text-on-surface-variant italic">--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {student.isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-mono text-[10px] font-bold" title="Structural similarity match above threshold">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            <span>{student.maxSimilarityPct ? `${student.maxSimilarityPct}% Match` : 'Flagged'}</span>
                          </span>
                        ) : student.aiDeclared ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface font-mono text-[10px]" title="Student declared constructive AI assistance">
                            <span className="material-symbols-outlined text-secondary text-[14px]">psychology</span>
                            <span>AI Disclosed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-mono text-[10px] text-on-surface" title="Independent code authoring">
                            <span className="material-symbols-outlined text-secondary text-[14px]">verified_user</span>
                            <span>Clean AST</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1.5">
                          {student.grade && (
                            <button
                              type="button"
                              onClick={() => setBreakdownStudent(student)}
                              className="px-2.5 py-1 rounded hover:bg-surface-container text-secondary text-xs font-semibold transition-colors"
                            >
                              Breakdown
                            </button>
                          )}
                          <Link
                            to={`/teacher/assignments/${selectedAssignmentId}/marking?submissionId=${student.submissionId}`}
                            className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                            title="Evaluate in Marking Workbench"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        <div className="px-5 py-3 border-t border-outline-variant/30 bg-surface-container-low flex items-center justify-between text-xs text-on-surface-variant font-mono">
          <span>Showing <strong>{filteredRoster.length}</strong> of <strong>{roster.length}</strong> student submissions</span>
          <span>Passing threshold: 60 / {assignmentInfo?.maxScore || 100}</span>
        </div>
      </div>

      {/* Institutional Sign-off Block (Visible on Print Only) */}
      <div className="hidden print:block mt-12 pt-8 border-t border-outline-variant">
        <div className="grid grid-cols-3 gap-8 text-xs text-on-surface">
          <div>
            <p className="font-bold">Course Instructor</p>
            <div className="mt-8 border-b border-black w-48"></div>
            <p className="mt-1 text-on-surface-variant">Signature &amp; Date</p>
          </div>
          <div>
            <p className="font-bold">Department Chair / Moderator</p>
            <div className="mt-8 border-b border-black w-48"></div>
            <p className="mt-1 text-on-surface-variant">Signature &amp; Date</p>
          </div>
          <div>
            <p className="font-bold">Controller of Examinations</p>
            <div className="mt-8 border-b border-black w-48"></div>
            <p className="mt-1 text-on-surface-variant">Official Seal</p>
          </div>
        </div>
      </div>

      {/* Student Score Breakdown Modal */}
      {breakdownStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setBreakdownStudent(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 text-on-surface border border-outline-variant/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div>
                <h3 className="text-base font-bold text-primary">{breakdownStudent.studentName}</h3>
                <p className="text-xs text-on-surface-variant font-mono">{breakdownStudent.studentEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => setBreakdownStudent(null)}
                className="p-1 rounded hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {/* Score summary banner */}
              <div className="p-3 rounded-lg bg-surface-container flex items-center justify-between">
                <div>
                  <span className="text-xs text-on-surface-variant font-mono">Final Mark</span>
                  <div className="text-2xl font-bold text-primary">
                    {breakdownStudent.grade.totalScore}{' '}
                    <span className="text-sm font-normal text-on-surface-variant">/ {assignmentInfo?.maxScore || 100}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    breakdownStudent.grade.status === 'finalised'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {breakdownStudent.grade.status === 'finalised' ? 'Finalised' : 'Provisional'}
                  </span>
                  <div className="font-mono text-xs text-on-surface-variant mt-1">
                    Grade: {getLetterGrade(breakdownStudent.grade.totalScore, assignmentInfo?.maxScore || 100)}
                  </div>
                </div>
              </div>

              {/* Rubric Components Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <span className="text-on-surface-variant font-mono block">Correctness (40%)</span>
                  <span className="text-sm font-bold text-on-surface">
                    {breakdownStudent.grade.correctnessScore} / 40
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <span className="text-on-surface-variant font-mono block">Understanding / Logic (30%)</span>
                  <span className="text-sm font-bold text-on-surface">
                    {breakdownStudent.grade.logicScore} / 30
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <span className="text-on-surface-variant font-mono block">Complexity Analysis (15%)</span>
                  <span className="text-sm font-bold text-on-surface">
                    {breakdownStudent.grade.complexityScore} / 15
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <span className="text-on-surface-variant font-mono block">AI Transparency (15%)</span>
                  <span className="text-sm font-bold text-on-surface">
                    {breakdownStudent.grade.transparencyScore} / 15
                  </span>
                </div>
              </div>

              {/* Feedback text */}
              {breakdownStudent.grade.feedback && (
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
                  <span className="text-xs font-bold text-on-surface block mb-1">Evaluator Feedback</span>
                  <p className="text-xs text-on-surface-variant italic">
                    "{breakdownStudent.grade.feedback}"
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Link
                to={`/teacher/assignments/${selectedAssignmentId}/marking?submissionId=${breakdownStudent.submissionId}`}
                className="px-4 py-2 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition-colors"
              >
                Open in Marking Workbench
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

