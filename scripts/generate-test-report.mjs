import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportsDir = path.join(root, 'reports');
const coverageSummaryPath = path.join(root, 'coverage', 'coverage-summary.json');
fs.mkdirSync(reportsDir, { recursive: true });

function decodeXml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function parseAttributes(source = '') {
  const result = {};
  for (const match of source.matchAll(/([\w:.-]+)="([\s\S]*?)"/g)) {
    result[match[1]] = decodeXml(match[2]);
  }
  return result;
}

function stripXml(value = '') {
  return decodeXml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function readJUnitFile(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const cases = [];
  const caseRegex = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const match of xml.matchAll(caseRegex)) {
    const attrs = parseAttributes(match[1]);
    const body = match[2] || '';
    let status = 'PASS';
    let detail = '';
    const failure = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>|<(failure|error)\b([^>]*)\s*\/>/i);
    const skipped = body.match(/<skipped\b([^>]*)>([\s\S]*?)<\/skipped>|<skipped\b([^>]*)\s*\/>/i);
    if (failure) {
      const tag = failure[1] || failure[4] || 'failure';
      const failureAttrs = parseAttributes(failure[2] || failure[5] || '');
      status = tag.toUpperCase() === 'ERROR' ? 'ERROR' : 'FAIL';
      detail = stripXml(failure[3] || '') || failureAttrs.message || failureAttrs.type || '';
    } else if (skipped) {
      status = 'SKIPPED';
      const skippedAttrs = parseAttributes(skipped[1] || skipped[3] || '');
      detail = stripXml(skipped[2] || '') || skippedAttrs.message || '';
    }
    cases.push({
      name: attrs.name || 'Unnamed test',
      suite: attrs.classname || path.basename(file),
      time: attrs.time || '',
      status,
      detail,
      source: path.basename(file),
    });
  }
  return cases;
}

function loadTests() {
  if (!fs.existsSync(reportsDir)) return [];
  const files = fs.readdirSync(reportsDir)
    .filter((name) => name.toLowerCase().endsWith('.xml'))
    .sort();
  const cases = [];
  for (const name of files) {
    try {
      cases.push(...readJUnitFile(path.join(reportsDir, name)));
    } catch (error) {
      console.warn(`Could not parse ${name}: ${error.message}`);
    }
  }
  return cases;
}

function loadCoverage() {
  if (!fs.existsSync(coverageSummaryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8')).total || null;
  } catch (error) {
    console.warn(`Could not read coverage summary: ${error.message}`);
    return null;
  }
}

const tests = loadTests();
const coverage = loadCoverage();
const counts = tests.reduce((acc, test) => {
  acc.total += 1;
  acc[test.status.toLowerCase()] += 1;
  return acc;
}, { total: 0, pass: 0, fail: 0, error: 0, skipped: 0 });
const successRate = counts.total ? ((counts.pass / counts.total) * 100).toFixed(2) : '0.00';

const xmlFiles = fs.existsSync(reportsDir)
  ? fs.readdirSync(reportsDir).filter((name) => name.toLowerCase().endsWith('.xml')).sort()
  : [];
const suiteRows = xmlFiles.map((file) => {
  const rows = tests.filter((test) => test.source === file);
  const total = rows.length;
  const passed = rows.filter((test) => test.status === 'PASS').length;
  const failed = rows.filter((test) => test.status === 'FAIL').length;
  const errors = rows.filter((test) => test.status === 'ERROR').length;
  const skipped = rows.filter((test) => test.status === 'SKIPPED').length;
  return { file, total, passed, failed, errors, skipped };
});

const metrics = [
  ['Statements', coverage?.statements],
  ['Branches', coverage?.branches],
  ['Functions', coverage?.functions],
  ['Lines', coverage?.lines],
];

function metricCell(metric) {
  if (!metric || typeof metric.pct !== 'number') return 'Not available';
  return `${metric.pct.toFixed(2)}% (${metric.covered}/${metric.total})`;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

const casesHtml = tests.length
  ? tests.map((test, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(test.name)}</td>
        <td>${esc(test.suite)}</td>
        <td class="status ${test.status.toLowerCase()}">${test.status}</td>
        <td>${esc(test.detail || '-')}</td>
      </tr>`).join('')
  : '<tr><td colspan="5">No JUnit test cases were found. Check that the test stages generated reports/*.xml.</td></tr>';

const suiteHtml = suiteRows.length
  ? suiteRows.map((row) => `
      <tr>
        <td>${esc(row.file)}</td><td>${row.total}</td><td>${row.passed}</td>
        <td>${row.failed}</td><td>${row.errors}</td><td>${row.skipped}</td>
      </tr>`).join('')
  : '<tr><td colspan="6">No JUnit XML files were found.</td></tr>';

const coverageHtml = metrics.map(([label, metric]) => `
  <tr><td>${label}</td><td>${metricCell(metric)}</td></tr>`).join('');

const now = new Date();
const buildDate = process.env.BUILD_TIMESTAMP || now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
const buildNumber = process.env.BUILD_NUMBER || 'Local run';
const buildUrl = process.env.BUILD_URL || '';
const commit = (process.env.GIT_COMMIT || '').slice(0, 12) || 'Not supplied';
const branch = process.env.BRANCH_NAME || process.env.GIT_BRANCH || 'main';
const buildResult = process.env.LABTRACK_PIPELINE_RESULT || 'Not supplied';
const nodeVersion = process.version;
const npmVersion = process.env.npm_config_user_agent?.match(/npm\/(\S+)/)?.[1] || 'See Jenkins console';
const workspace = process.env.WORKSPACE || root;
const reportTitle = 'LabTrack Test Execution Report';

const buildNote = buildResult.toUpperCase() === 'SUCCESS'
  ? 'The Jenkins pipeline completed successfully.'
  : buildResult.toUpperCase() === 'FAILURE'
    ? 'The Jenkins pipeline did not complete successfully. Review failed test cases and the Jenkins console output for the stage-level cause.'
    : 'The pipeline result was not supplied to the report generator.';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${reportTitle}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f2f4f7; color: #202733; font: 14px/1.55 Arial, Helvetica, sans-serif; }
  .page { max-width: 980px; margin: 28px auto; padding: 42px 54px; background: white; box-shadow: 0 2px 16px rgba(20,30,50,.08); }
  .running { display:flex; justify-content:space-between; gap:24px; border-bottom:1px solid #7d8794; padding-bottom:8px; color:#4a5563; font-size:12px; }
  .hero { text-align:center; padding:36px 0 22px; }
  .eyebrow { text-transform:uppercase; letter-spacing:2px; font-size:12px; color:#526173; font-weight:700; }
  h1 { margin:10px 0 8px; font-family:Georgia,serif; font-size:32px; letter-spacing:.4px; }
  .subtitle { color:#586575; font-size:15px; }
  h2 { margin:30px 0 10px; padding-bottom:6px; border-bottom:1px solid #c8ced6; font: bold 22px Georgia,serif; }
  p { margin:9px 0 14px; }
  table { width:100%; border-collapse:collapse; margin:12px 0 20px; page-break-inside:auto; }
  th, td { border:1px solid #9ba4af; padding:8px 9px; text-align:left; vertical-align:top; }
  th { background:#eef1f5; font-weight:700; }
  .summary th, .summary td { text-align:center; }
  .summary td:first-child, .summary th:first-child { text-align:left; }
  .status { font-weight:700; white-space:nowrap; }
  .status.pass { color:#176b3a; }
  .status.fail, .status.error { color:#a12626; }
  .status.skipped { color:#805b13; }
  .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0; }
  .stat { border:1px solid #c8ced6; padding:12px; text-align:center; }
  .stat b { display:block; font-size:23px; }
  .stat span { color:#657181; font-size:12px; }
  .note { border-left:4px solid #65758a; background:#f3f5f8; padding:12px 14px; margin:14px 0; }
  .muted { color:#687383; }
  .small { font-size:12px; }
  .footer { margin-top:32px; padding-top:8px; border-top:1px solid #aab2bc; color:#687383; font-size:11px; display:flex; justify-content:space-between; }
  @page { size:A4; margin:15mm 14mm 17mm; }
  @media print {
    body { background:white; font-size:10.5pt; }
    .page { max-width:none; margin:0; padding:0; box-shadow:none; }
    .running { position:static; }
    h2 { break-after:avoid; }
    tr { break-inside:avoid; }
    thead { display:table-header-group; }
    .stat-grid { break-inside:avoid; }
    a { color:inherit; text-decoration:none; }
  }
  @media (max-width:700px) {
    .page { margin:0; padding:22px; }
    .stat-grid { grid-template-columns:repeat(2,1fr); }
    table { font-size:12px; }
  }
</style>
</head>
<body>
<main class="page">
  <div class="running"><strong>LabTrack</strong><span>Automated Testing and CI Report</span></div>
  <header class="hero">
    <div class="eyebrow">LabTrack</div>
    <h1>${reportTitle}</h1>
    <div class="subtitle">React · Vite · Node.js · Express · MySQL · Node Test Runner · c8 · Jenkins</div>
  </header>

  <h2>1. Test Execution Summary</h2>
  <p>This report consolidates the JUnit test results and code coverage artifacts produced during the LabTrack Jenkins build. Counts below are calculated from the discovered JUnit XML files.</p>
  <div class="stat-grid">
    <div class="stat"><b>${counts.total}</b><span>Total test cases</span></div>
    <div class="stat"><b>${counts.pass}</b><span>Passed</span></div>
    <div class="stat"><b>${counts.fail}</b><span>Failed</span></div>
    <div class="stat"><b>${counts.error + counts.skipped}</b><span>Errors + skipped</span></div>
  </div>
  <table class="summary">
    <thead><tr><th>Execution Suite</th><th>Total</th><th>Passed</th><th>Failed</th><th>Errors</th><th>Skipped</th></tr></thead>
    <tbody>${suiteHtml}</tbody>
    <tfoot><tr><th>Combined total</th><th>${counts.total}</th><th>${counts.pass}</th><th>${counts.fail}</th><th>${counts.error}</th><th>${counts.skipped}</th></tr></tfoot>
  </table>
  <p><strong>Test success rate:</strong> ${successRate}% of discovered JUnit test cases passed.</p>

  <h2>2. Test Cases</h2>
  <p>Each row reflects an individual test case recorded in the JUnit XML generated by the test runner. Failure details are included when available in the XML.</p>
  <table>
    <thead><tr><th style="width:5%">No.</th><th style="width:31%">Test Scenario</th><th style="width:23%">Test Suite / Class</th><th style="width:10%">Status</th><th>Execution Detail</th></tr></thead>
    <tbody>${casesHtml}</tbody>
  </table>

  <h2>3. Code Coverage Results</h2>
  <p>Coverage values are read from c8's JSON summary. They describe the source files instrumented by the configured unit-test command, not necessarily every application module.</p>
  <table><thead><tr><th>Metric</th><th>Coverage</th></tr></thead><tbody>${coverageHtml}</tbody></table>
  ${coverage ? '' : '<div class="note">Coverage summary was not found. Add the c8 json-summary reporter to generate coverage/coverage-summary.json.</div>'}

  <h2>4. Test Environment</h2>
  <table><tbody>
    <tr><th style="width:32%">Application</th><td>LabTrack - DSA Assignment and Evaluation Platform</td></tr>
    <tr><th>Frontend build tool</th><td>Vite 6.4.5 (version observed in the supplied Jenkins log)</td></tr>
    <tr><th>Runtime</th><td>Node.js ${esc(nodeVersion)}; npm ${esc(npmVersion)}</td></tr>
    <tr><th>Test framework</th><td>Node.js built-in test runner</td></tr>
    <tr><th>Coverage tool</th><td>c8</td></tr>
    <tr><th>CI environment</th><td>Jenkins on Windows</td></tr>
    <tr><th>Workspace</th><td>${esc(workspace)}</td></tr>
    <tr><th>Build number</th><td>${esc(buildNumber)}</td></tr>
    <tr><th>Branch</th><td>${esc(branch)}</td></tr>
    <tr><th>Commit</th><td>${esc(commit)}</td></tr>
    <tr><th>Execution date</th><td>${esc(buildDate)}</td></tr>
  </tbody></table>

  <h2>5. Test Execution Details</h2>
  <p><strong>Unit tests and coverage:</strong> <code>npm run test:coverage</code></p>
  <p><strong>Web production build:</strong> <code>npm run web:build</code></p>
  <p><strong>API integration tests:</strong> <code>node --test --test-concurrency=1 ... tests/api/*.test.mjs</code> (when enabled by the Jenkins parameter).</p>
  <p><strong>JUnit report files:</strong> <code>reports/*.xml</code></p>
  <p><strong>Coverage report:</strong> <code>coverage/index.html</code></p>
  ${buildUrl ? `<p><strong>Jenkins build:</strong> <a href="${esc(buildUrl)}">${esc(buildUrl)}</a></p>` : ''}

  <h2>6. Overall Test Results</h2>
  <table class="summary"><tbody>
    <tr><th>Total tests</th><td>${counts.total}</td></tr>
    <tr><th>Passed</th><td>${counts.pass}</td></tr>
    <tr><th>Failed</th><td>${counts.fail}</td></tr>
    <tr><th>Errors</th><td>${counts.error}</td></tr>
    <tr><th>Skipped</th><td>${counts.skipped}</td></tr>
    <tr><th>Success rate</th><td>${successRate}%</td></tr>
    <tr><th>Jenkins pipeline result</th><td>${esc(buildResult)}</td></tr>
  </tbody></table>
  <div class="note">${esc(buildNote)}</div>

  <h2>7. Verification Note</h2>
  <p>This report is generated from available JUnit XML and c8 coverage artifacts. A test suite is counted only when its XML result file is present. If an integration suite cannot connect to its configured database, its failed tests are reported as failures; the report does not treat infrastructure failures as successful application behaviour.</p>
  <p class="muted small">Generated automatically by scripts/generate-test-report.mjs. Review the Jenkins console and linked artifacts for full diagnostic output.</p>
  <div class="footer"><span>LabTrack - Automated Testing Report</span><span>Build ${esc(buildNumber)}</span></div>
</main>
</body>
</html>`;

const outputPath = path.join(reportsDir, 'LabTrack-Test-Report.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Generated ${outputPath}`);
console.log(`JUnit cases: ${counts.total}, passed: ${counts.pass}, failed: ${counts.fail}, errors: ${counts.error}, skipped: ${counts.skipped}`);
console.log(`Coverage summary: ${coverage ? 'found' : 'not found'}`);
