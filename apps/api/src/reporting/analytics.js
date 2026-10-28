/**
 * Cohort analytics, statistical calculations, and RFC 4180 CSV export.
 * Handles edge cases: N = 0 (empty cohort), N = 1 (single submission), identical scores.
 */

/**
 * Calculates arithmetic mean.
 * @param {number[]} numbers
 * @returns {number}
 */
export function calculateMean(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / numbers.length) * 100) / 100;
}

/**
 * Calculates median.
 * @param {number[]} numbers
 * @returns {number}
 */
export function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return Math.round(sorted[mid] * 100) / 100;
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

/**
 * Calculates sample standard deviation.
 * @param {number[]} numbers
 * @returns {number}
 */
export function calculateStdDev(numbers) {
  if (!numbers || numbers.length <= 1) return 0;
  const mean = calculateMean(numbers);
  const squaredDiffs = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const variance = squaredDiffs / (numbers.length - 1);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * Calculates pass rate percentage.
 * @param {number[]} numbers
 * @param {number} [passThreshold=60]
 * @returns {number}
 */
export function calculatePassRate(numbers, passThreshold = 60) {
  if (!numbers || numbers.length === 0) return 0;
  const passed = numbers.filter((score) => score >= passThreshold).length;
  return Math.round((passed / numbers.length) * 1000) / 10;
}

/**
 * Computes histogram distribution bins (<60, 60-69, 70-79, 80-89, 90-100).
 * @param {number[]} scores
 * @returns {Array<{ bin: string, count: number, percentage: number }>}
 */
export function calculateDistributionBins(scores) {
  const total = scores.length;
  const bins = [
    { interval: '<60', bin: '<60 (Fail)', label: '<60 (Fail)', count: 0, min: 0, max: 59.99 },
    { interval: '60–69', bin: '60–69 (C)', label: '60–69 (C)', count: 0, min: 60, max: 69.99 },
    { interval: '70–79', bin: '70–79 (B)', label: '70–79 (B)', count: 0, min: 70, max: 79.99 },
    { interval: '80–89', bin: '80–89 (A-)', label: '80–89 (A-)', count: 0, min: 80, max: 89.99 },
    { interval: '90–100', bin: '90–100 (A+)', label: '90–100 (A+)', count: 0, min: 90, max: 1000 },
  ];

  for (const s of scores) {
    for (const b of bins) {
      if (s >= b.min && s <= b.max) {
        b.count++;
        break;
      }
    }
  }

  return bins.map((b) => ({
    interval: b.interval,
    bin: b.bin,
    label: b.label,
    count: b.count,
    percentage: total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0,
  }));
}

/**
 * Computes all cohort metrics.
 * @param {Array} cohortRoster - Array of student submission records with grades & similarity
 * @param {number} [maxScore=100]
 * @returns {object}
 */
export function calculateCohortMetrics(cohortRoster = [], maxScore = 100) {
  const totalSubmissions = cohortRoster.length;
  if (totalSubmissions === 0) {
    return {
      totalSubmissions: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      passRate: 0,
      aiDeclarationRate: 0,
      similarityFlagRate: 0,
      evaluatedCount: 0,
      pendingCount: 0,
      avgCorrectness: 0,
      avgUnderstanding: 0,
      distributionBins: calculateDistributionBins([]),
    };
  }

  // Only compute grade statistics across evaluated submissions
  const evaluatedSubmissions = cohortRoster.filter(
    (r) => r.grade?.totalScore != null || (r.totalScore != null && r.totalScore > 0) || (r.gradeStatus && r.gradeStatus !== 'pending_review')
  );
  const scores = evaluatedSubmissions.map((r) => Number(r.totalScore ?? r.grade?.totalScore));
  const correctnessScores = evaluatedSubmissions.map((r) => Number(r.correctnessScore ?? r.grade?.correctnessScore) || 0);
  const logicScores = evaluatedSubmissions.map((r) => (Number(r.logicScore ?? r.grade?.logicScore) || 0) + (Number(r.complexityScore ?? r.grade?.complexityScore) || 0));

  const mean = calculateMean(scores);
  const median = calculateMedian(scores);
  const stdDev = calculateStdDev(scores);
  const passRate = calculatePassRate(scores, Math.round(maxScore * 0.6));

  const aiDeclaredCount = cohortRoster.filter((r) => r.aiDeclared).length;
  const aiDeclarationRate = Math.round((aiDeclaredCount / totalSubmissions) * 1000) / 10;

  const flaggedCount = cohortRoster.filter((r) => r.isFlagged).length;
  const similarityFlagRate = Math.round((flaggedCount / totalSubmissions) * 1000) / 10;

  const evaluatedCount = cohortRoster.filter((r) => {
    const status = r.gradeStatus || r.grade?.status;
    return status === 'finalised' || status === 'provisional' || status === 'provisionally_scored';
  }).length;
  const pendingCount = totalSubmissions - evaluatedCount;

  return {
    totalSubmissions,
    totalEvaluated: evaluatedCount,
    evaluatedCount,
    pendingCount,
    mean,
    median,
    stdDev,
    passRate,
    aiDeclarationRate,
    similarityFlagRate,
    avgCorrectness: calculateMean(correctnessScores),
    avgUnderstanding: calculateMean(logicScores),
    distributionBins: calculateDistributionBins(scores),
  };
}

/**
 * RFC 4180 CSV string escaping.
 * Escapes fields containing commas, double quotes, or newlines.
 * @param {any} val
 * @returns {string}
 */
export function escapeCsvField(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string for cohort results.
 * @param {Array} cohortRoster
 * @param {object} assignment
 * @returns {string}
 */
export function generateCohortCsv(cohortRoster, assignment = {}) {
  const headers = [
    'Student ID',
    'Student Name',
    'Student Email',
    'Assignment Code',
    'Language',
    'Submission Date',
    'Correctness Score (40)',
    'Logic Score (30)',
    'Complexity Score (15)',
    'AI Transparency Score (15)',
    'Total Score',
    'Max Score',
    'Grade Level',
    'Evaluation Status',
    'AI Declared',
    'AI Tools',
    'Similarity Flagged',
    'Similarity Score',
    'Teacher Feedback',
  ];

  const rows = [headers.map(escapeCsvField).join(',')];

  for (const r of cohortRoster) {
    const total = Number(r.totalScore ?? r.grade?.totalScore) || 0;
    let gradeLevel = 'F';
    if (total >= 90) gradeLevel = 'A+';
    else if (total >= 80) gradeLevel = 'A';
    else if (total >= 70) gradeLevel = 'B';
    else if (total >= 60) gradeLevel = 'C';

    const row = [
      r.studentRoll || r.studentId,
      r.studentName,
      r.studentEmail,
      assignment.assignmentCode || '',
      r.language || '',
      r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
      r.correctnessScore ?? r.grade?.correctnessScore ?? 0,
      r.logicScore ?? r.grade?.logicScore ?? 0,
      r.complexityScore ?? r.grade?.complexityScore ?? 0,
      r.transparencyScore ?? r.grade?.transparencyScore ?? 0,
      total,
      assignment.maxScore || 100,
      gradeLevel,
      r.gradeStatus || r.grade?.status || 'pending_review',
      r.aiDeclared ? 'YES' : 'NO',
      Array.isArray(r.aiTools) ? r.aiTools.join('; ') : '',
      r.isFlagged ? 'YES' : 'NO',
      r.similarityScore != null ? `${r.similarityScore}%` : 'N/A',
      r.feedback || r.grade?.feedback || '',
    ];

    rows.push(row.map(escapeCsvField).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}
