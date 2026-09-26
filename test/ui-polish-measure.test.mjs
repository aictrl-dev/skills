import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

// measure.cjs drives a real browser. It needs Playwright with Chromium, which this package does not depend
// on; point NODE_PATH at a node_modules that has it. Without it the tests skip instead of failing.
const script = join(ROOT, 'skills/ui-polish/scripts/measure.cjs');
const fixtures = join(ROOT, 'evals/fixtures/ui-polish/noise');

function browserMissing() {
  const require = createRequire(join(ROOT, 'package.json'));
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const { chromium } = require(name);
      return existsSync(chromium.executablePath()) ? false : `${name} is installed but Chromium is not (npx playwright install chromium)`;
    } catch { /* try the next one */ }
  }
  return 'Playwright is not installed; set NODE_PATH to a node_modules with playwright and Chromium to run the ui-polish measure tests';
}
const skip = browserMissing();

const work = mkdtempSync(join(tmpdir(), 'aictrl-ui-polish-'));
after(() => rmSync(work, { recursive: true, force: true }));
let runs = 0;

function measure(targets, args = [], { cwd = ROOT } = {}) {
  const out = join(work, `run-${++runs}`);
  const files = (Array.isArray(targets) ? targets : [targets]).map((t) => join(fixtures, t));
  const result = spawnSync(process.execPath, [script, ...files, '--offline', '--out', out, ...args], { cwd, encoding: 'utf8', timeout: 120000 });
  const file = join(out, 'measure.json');
  return { ...result, out, report: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null };
}

const loud = (report, check) => report.findings.filter((f) => f.check === check && f.severity !== 'info');
const detail = (findings) => findings.map((f) => `${f.severity} ${f.viewport} ${f.message} (${f.selector})`).join('\n');
function assertQuiet(report, checks) {
  for (const check of checks) assert.deepEqual(loud(report, check), [], `${check} should not warn or error:\n${detail(loud(report, check))}`);
}

// ---- false positives: each fixture must be quiet for its check

test('ui-polish: a small checkbox or radio in a 44px label row is a full-size target', { skip }, () => {
  const r = measure('checkbox-label.html', ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['tap-target']);
});

test('ui-polish: honeypots, sr-only and off-screen text are not measured', { skip }, () => {
  const r = measure('honeypot.html', ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['tap-target', 'text-size', 'contrast', 'input-font-size', 'accessible-name']);
  for (const hidden of ['Required fields are marked with an asterisk', 'Off-screen note for robots', 'Website', 'Skip to the form']) {
    assert.ok(!r.report.copy.includes(hidden), `copy should not include hidden text "${hidden}"`);
  }
});

test('ui-polish: a link inside a sentence is an inline target wherever the sentence sits', { skip }, () => {
  const r = measure('inline-link.html', ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['tap-target']);
});

test('ui-polish: short uppercase letter-spaced labels are reported as info, not warnings', { skip }, () => {
  const r = measure('eyebrow.html', ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['text-size']);
  const info = r.report.findings.filter((f) => f.check === 'text-size' && f.severity === 'info');
  assert.ok(info.some((f) => /eyebrow/.test(f.message) && f.group === '.eyebrow' && f.count === 2), detail(info));
});

test('ui-polish: a heading just above a scoped form, or labelling it, is info', { skip }, () => {
  for (const [scope, how] of [['#signup', /sits \d+px above it/], ['#prefs', /aria-labelledby/]]) {
    const r = measure('scoped-heading.html', ['--viewports', 'phone', '--scope', scope]);
    assert.equal(r.status, 0, r.stderr);
    assertQuiet(r.report, ['heading']);
    const [h] = r.report.findings.filter((f) => f.check === 'heading');
    assert.ok(h && h.severity === 'info' && /outside the scope/.test(h.message) && how.test(h.message), `${scope}: ${h && h.message}`);
  }
});

test('ui-polish: --profile content skips the form-step checks', { skip }, () => {
  const formSteps = ['type-scale', 'action-distance', 'action-below-fold', 'dead-space'];
  const form = measure('content-page.html', ['--viewports', 'phone']);
  assert.equal(form.status, 1, 'the default form profile still gates on action-below-fold');
  assert.ok(formSteps.every((c) => form.report.findings.some((f) => f.check === c)), detail(form.report.findings));
  const content = measure('content-page.html', ['--viewports', 'phone', '--profile', 'content']);
  assert.equal(content.status, 0, content.stderr);
  assert.equal(content.report.profile, 'content');
  assert.deepEqual(content.report.findings.filter((f) => formSteps.includes(f.check)), []);
  assert.equal(measure('content-page.html', ['--profile', 'article']).status, 2);
});

test('ui-polish: a finding accepted in the project config moves to accepted with its reason', { skip }, () => {
  const config = join(work, 'accepted.json');
  const reason = 'legal small print, reviewed with the owner';
  writeFileSync(config, JSON.stringify({ ignore: [{ check: 'text-size', selector: '.fine-print', reason }] }));
  const plain = measure('config-ignore.html', ['--viewports', 'phone']);
  assert.equal(loud(plain.report, 'text-size').length, 1, 'without the config the small print warns');
  const r = measure('config-ignore.html', ['--viewports', 'phone', '--config', config]);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['text-size']);
  assert.equal(r.report.accepted.length, 1);
  assert.equal(r.report.accepted[0].check, 'text-size');
  assert.equal(r.report.accepted[0].reason, reason);
  assert.match(r.stdout, /Accepted \(project config\):[\s\S]*legal small print/);

  // found in the current directory without --config
  const dir = mkdtempSync(join(work, 'cwd-'));
  writeFileSync(join(dir, 'ui-polish.config.json'), readFileSync(config));
  assert.equal(measure('config-ignore.html', ['--viewports', 'phone'], { cwd: dir }).report.accepted.length, 1);

  // compare lists accepted findings on their own, not as fixed
  const cmp = spawnSync(process.execPath, [script, '--compare', join(plain.out, 'measure.json'), join(r.out, 'measure.json')], { encoding: 'utf8' });
  assert.equal(cmp.status, 0, cmp.stdout);
  assert.match(cmp.stdout, /^Fixed 0 · remaining 0 · new 0 · accepted 1/);

  // a rule without a reason is a usage error
  writeFileSync(config, JSON.stringify({ ignore: [{ check: 'text-size', selector: '.fine-print' }] }));
  assert.equal(measure('config-ignore.html', ['--config', config]).status, 2);
});

test('ui-polish: --hide removes overlays before measuring', { skip }, () => {
  const shown = measure('overlay.html', ['--viewports', 'phone']);
  assert.ok(loud(shown.report, 'tap-target').length && loud(shown.report, 'text-size').length, detail(shown.report.findings));
  const r = measure('overlay.html', ['--viewports', 'phone', '--hide', '.cookie-banner, .chat-launcher']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['tap-target', 'text-size']);
  assert.deepEqual(r.report.hidden, { selectors: '.cookie-banner, .chat-launcher', matched: 1 });
  assert.equal(measure('overlay.html', ['--hide', 'div[']).status, 2);
});

// ---- positive controls: genuine defects still fire

test('ui-polish: a bare 20px checkbox, a short label row and a standalone link still fail', { skip }, () => {
  const r = measure('controls-bare-checkbox.html', ['--viewports', 'phone']);
  assert.equal(r.status, 1);
  const taps = r.report.findings.filter((f) => f.check === 'tap-target');
  const by = (name) => taps.find((f) => f.selector.includes(name));
  assert.equal(by('digest').severity, 'error');
  assert.equal(by('alerts').severity, 'warn');
  assert.match(by('alerts').message, /its label extends it to \d+×30px/);
  assert.ok(taps.some((f) => f.selector.endsWith('> a')), detail(taps));
});

test('ui-polish: a 13px paragraph of body text is a text-size warning', { skip }, () => {
  const r = measure('controls-small-body.html', ['--viewports', 'phone']);
  const [f] = loud(r.report, 'text-size');
  assert.ok(f, detail(r.report.findings));
  assert.equal(f.severity, 'warn');
  assert.equal(f.fontSize, 13);
  assert.match(f.message, /^13px × 1 text run \(\.body-small\)/);
});

test('ui-polish: a scoped form with no heading nearby still warns', { skip }, () => {
  for (const scope of ['#bare', '#far']) {
    const r = measure('controls-missing-heading.html', ['--viewports', 'phone', '--scope', scope]);
    const h = r.report.findings.filter((f) => f.check === 'heading');
    assert.deepEqual(h.map((f) => f.severity), ['warn'], `${scope}: ${detail(h)}`);
  }
});

// ---- output layout

test('ui-polish: one target keeps its output paths and adds a scope screenshot', { skip }, () => {
  const r = measure('checkbox-label.html');
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['measure.json', 'phone.png', 'desktop.png', 'phone-scope.png', 'desktop-scope.png']) assert.ok(existsSync(join(r.out, f)), f);
  assert.ok(!existsSync(join(r.out, 'summary.json')));
  assert.equal(r.report.viewports.phone.scopeScreenshot, 'phone-scope.png');
  assert.equal(r.report.accepted, undefined, 'no config, no accepted list');
});

test('ui-polish: several targets write one folder each and a merged summary', { skip }, () => {
  const r = measure(['controls-small-body.html', 'controls-small-body.html', 'eyebrow.html'], ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  const summary = JSON.parse(readFileSync(join(r.out, 'summary.json'), 'utf8'));
  assert.deepEqual(summary.targets.map((t) => t.slug), ['controls-small-body', 'controls-small-body-2', 'eyebrow']);
  for (const t of summary.targets) assert.ok(existsSync(join(r.out, t.measure)), t.measure);
  const body = summary.merged.find((m) => m.check === 'text-size' && m.severity === 'warn');
  assert.deepEqual(body.pages, ['controls-small-body', 'controls-small-body-2']);
  assert.match(r.stdout, /2 pages: controls-small-body, controls-small-body-2/);
});

test('ui-polish: --compare still reads measure.json files from before grouping', { skip }, () => {
  const r = measure('controls-small-body.html', ['--viewports', 'phone']);
  const old = join(work, 'old-measure.json');
  writeFileSync(old, JSON.stringify({ findings: [{ viewport: 'phone', check: 'text-size', severity: 'warn', selector: 'main > p', anchor: '', message: '1 text runs are smaller than 14px' }], copy: r.report.copy }));
  const cmp = spawnSync(process.execPath, [script, '--compare', old, join(r.out, 'measure.json')], { encoding: 'utf8' });
  assert.equal(cmp.status, 0, cmp.stdout);
  assert.match(cmp.stdout, /^Fixed 1 · remaining 0 · new 1/);
});
