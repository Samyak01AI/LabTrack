/**
 * Rubric scoring calculations and provisional marks computation.
 * Combines automated test results with teacher-evaluated logic defense and AI transparency.
 */

export const DEFAULT_RUBRIC_WEIGHTS = {
  correctness: 40,
  logic: 30,
  complexity: 15,
  transparency: 15,
};

/**
 * Computes provisional grades from submission metadata and Judge0 test results.
 * All computed marks remain PROVISIONAL until explicitly finalised by a teacher.
 *
 * @param {object} submission
 * @param {object} [assignment]
 * @returns {object} Provisional grade breakdown
 */
export function computeProvisionalGrade(submission, assignment = {}) {
  const maxScore = Number(assignment.maxScore) || 100;
  const scale = maxScore / 100;

  const maxCorrectness = Math.round(DEFAULT_RUBRIC_WEIGHTS.correctness * scale * 100) / 100;
  const maxLogic = Math.round(DEFAULT_RUBRIC_WEIGHTS.logic * scale * 100) / 100;
  const maxComplexity = Math.round(DEFAULT_RUBRIC_WEIGHTS.complexity * scale * 100) / 100;
  const maxTransparency = Math.round(DEFAULT_RUBRIC_WEIGHTS.transparency * scale * 100) / 100;

  // 1. Automated correctness score from test cases
  let correctnessScore = 0;
  const results = submission.results || [];
  if (Array.isArray(results) && results.length > 0) {
    const passedCount = results.filter((r) => r.status === 'PASS').length;
    correctnessScore = Math.round((passedCount / results.length) * maxCorrectness * 100) / 100;
  } else if (submission.status === 'accepted') {
    correctnessScore = maxCorrectness;
  }

  // 2. Logic & algorithmic approach
  let logicScore = 0;
  const expl = submission.logicExplanation || {};
  const approachLen = (expl.approach || '').trim().length;
  const tradeoffLen = (expl.tradeoffAnalysis || '').trim().length;
  const totalLogicLen = approachLen + tradeoffLen;

  if (totalLogicLen >= 120) {
    logicScore = Math.round(maxLogic * 0.9 * 100) / 100;
  } else if (totalLogicLen >= 60) {
    logicScore = Math.round(maxLogic * 0.75 * 100) / 100;
  } else if (totalLogicLen > 0) {
    logicScore = Math.round(maxLogic * 0.5 * 100) / 100;
  }

  // 3. Complexity analysis & data structures
  let complexityScore = 0;
  const dsLen = (expl.dataStructures || '').trim().length;
  if (dsLen >= 60) {
    complexityScore = maxComplexity;
  } else if (dsLen >= 20) {
    complexityScore = Math.round(maxComplexity * 0.8 * 100) / 100;
  } else if (dsLen > 0) {
    complexityScore = Math.round(maxComplexity * 0.5 * 100) / 100;
  }

  // 4. AI transparency adherence & constructive disclosure
  let transparencyScore = 0;
  const declaration = submission.aiDeclaration || {};
  const annotStatus = submission.annotationStatus || 'not_required';

  if (declaration.aiUsed === false) {
    // Independent problem solving declared
    transparencyScore = maxTransparency;
  } else if (declaration.aiUsed === true) {
    if (annotStatus === 'complete') {
      // AI used and fully annotated/cited
      transparencyScore = maxTransparency;
    } else {
      // Incomplete annotations
      transparencyScore = Math.round(maxTransparency * 0.4 * 100) / 100;
    }
  }

  const totalScore = calculateTotal(
    { correctnessScore, logicScore, complexityScore, transparencyScore },
    maxScore,
  );

  return {
    correctnessScore,
    logicScore,
    complexityScore,
    transparencyScore,
    totalScore,
    maxScore,
    rubricBreakdown: {
      correctness: { score: correctnessScore, max: maxCorrectness, label: 'Automated Test Correctness' },
      logic: { score: logicScore, max: maxLogic, label: 'Algorithmic Approach & Invariants' },
      complexity: { score: complexityScore, max: maxComplexity, label: 'Data Structures & Complexity Bounds' },
      transparency: { score: transparencyScore, max: maxTransparency, label: 'AI Transparency & Viva Defense' },
    },
    status: 'provisionally_scored',
  };
}

/**
 * Calculates and validates total score, ensuring components are non-negative and capped at maxScore.
 *
 * @param {object} scores - { correctnessScore, logicScore, complexityScore, transparencyScore }
 * @param {number} maxScore - Total maximum score for assignment
 * @returns {number}
 */
export function calculateTotal(scores, maxScore = 100) {
  const c = Math.max(0, Number(scores.correctnessScore) || 0);
  const l = Math.max(0, Number(scores.logicScore) || 0);
  const x = Math.max(0, Number(scores.complexityScore) || 0);
  const t = Math.max(0, Number(scores.transparencyScore) || 0);

  const rawSum = Math.round((c + l + x + t) * 100) / 100;
  return Math.min(Number(maxScore) || 100, rawSum);
}

