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

test('ui-polish: a 44px label[for] beside a 20px checkbox with a small gap is the target', { skip }, () => {
  const r = measure('checkbox-label-gap.html', ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['tap-target']);
});

test('ui-polish: a heading directly above a scoped form in main is info', { skip }, () => {
  const r = measure('heading-above-scope.html', ['--viewports', 'phone', '--scope', '#f']);
  const h = r.report.findings.filter((f) => f.check === 'heading');
  assert.deepEqual(h.map((f) => f.severity), ['info'], detail(h));
  assert.match(h[0].message, /Heading is outside the scope: "Create your account" sits \d+px above it/);
});

test('ui-polish: honeypots, sr-only and off-screen text are not measured', { skip }, () => {
  const r = measure('honeypot.html', ['--viewports', 'phone']);
  assert.equal(r.status, 0, r.stderr);
  assertQuiet(r.report, ['tap-target', 'text-size', 'contrast', 'input-font-size', 'accessible-name']);
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
  assert.equal(info.length, 1, detail(info));
  assert.match(info[0].message, /eyebrow/);
  assert.ok(info[0].groups.some((g) => g.signature === '.eyebrow' && g.count === 2 && g.eyebrow === true), JSON.stringify(info[0].groups));
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
  // the article has no empty band (its shaded figure is content), so dead-space is not expected here
  assert.ok(formSteps.slice(0, 3).every((c) => form.report.findings.some((f) => f.check === c)), detail(form.report.findings));
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

test('ui-polish: aria-hidden content that is on screen is still measured', { skip }, () => {
  const r = measure('aria-hidden-visible.html', ['--viewports', 'phone']);
  assert.equal(r.status, 1);
  for (const check of ['contrast', 'text-size', 'tap-target']) assert.ok(loud(r.report, check).length, `${check}:\n${detail(r.report.findings)}`);
  assert.equal(loud(r.report, 'tap-target')[0].severity, 'error');
});

test('ui-polish: text clipped only by half (inset(50% 0 0 0)) is still measured', { skip }, () => {
  const r = measure('clip-partial.html', ['--viewports', 'phone']);
  assert.ok(loud(r.report, 'text-size').length && loud(r.report, 'contrast').length, detail(r.report.findings));
});

test('ui-polish: a number added only in sr-only or aria-hidden copy fails --compare', { skip }, () => {
  const before = measure('copy-before.html', ['--viewports', 'phone']);
  const after = measure('copy-after-hidden-number.html', ['--viewports', 'phone']);
  assert.ok(after.report.copy.includes('Trusted by 12,000 teams') && after.report.copy.includes('Rated 4.9 out of 5'), after.report.copy.join(' | '));
  const cmp = spawnSync(process.execPath, [script, '--compare', join(before.out, 'measure.json'), join(after.out, 'measure.json')], { encoding: 'utf8' });
  assert.equal(cmp.status, 1, cmp.stdout);
  assert.match(cmp.stdout, /invented-number[\s\S]*12,000[\s\S]*4\.9/);
});

test('ui-polish: list items, a details summary and chips in a card are content, not dead space', { skip }, () => {
  for (const page of ['dead-space-list.html', 'dead-space-chips.html']) {
    const r = measure(page, ['--viewports', 'phone']);
    assert.deepEqual(r.report.findings.filter((f) => f.check === 'dead-space'), [], `${page}:\n${detail(r.report.findings)}`);
  }
});

test('ui-polish: a forced full-height form still reports its empty band', { skip }, () => {
  const r = measure('controls-dead-space.html', ['--viewports', 'phone']);
  const [f] = r.report.findings.filter((x) => x.check === 'dead-space');
  assert.ok(f && f.severity === 'warn' && f.measured > 400, detail(r.report.findings));
});

test('ui-polish: a bare 20px checkbox, a short label row and a standalone link still fail', { skip }, () => {
  const r = measure('controls-bare-checkbox.html', ['--viewports', 'phone']);
  assert.equal(r.status, 1);
  const taps = r.report.findings.filter((f) => f.check === 'tap-target');
  const by = (name) => taps.find((f) => f.selector.includes(name));
  assert.equal(by('digest').severity, 'error');
  assert.equal(by('alerts').severity, 'warn');
  assert.match(by('alerts').message, /its label is a \d+×30px target/);
  assert.ok(taps.some((f) => f.selector.endsWith('> a')), detail(taps));
});

test('ui-polish: a label below the control, or with no box, does not enlarge the target', { skip }, () => {
  const r = measure('controls-label-apart.html', ['--viewports', 'phone']);
  const taps = r.report.findings.filter((f) => f.check === 'tap-target');
  for (const name of ['stacked', 'contents']) {
    const f = taps.find((x) => x.selector.includes(name) || (x.members || []).some((m) => m.selector.includes(name)));
    assert.ok(f && f.severity === 'error', `${name}:\n${detail(taps)}`);
  }
});

test('ui-polish: links in a pager or a sort row are not inline text', { skip }, () => {
  const r = measure('controls-link-lists.html', ['--viewports', 'phone']);
  const taps = loud(r.report, 'tap-target');
  const covered = taps.flatMap((f) => (f.members || [f]).map((m) => m.selector));
  for (const row of ['pager', 'sort']) assert.ok(covered.some((s) => s.includes(row)), `${row}:\n${detail(taps)}`);
  assert.ok(taps.every((f) => f.severity === 'error'), detail(taps));
});

test('ui-polish: a 13px paragraph of body text is a text-size warning', { skip }, () => {
  const r = measure('controls-small-body.html', ['--viewports', 'phone']);
  const [f] = loud(r.report, 'text-size');
  assert.ok(f, detail(r.report.findings));
  assert.equal(f.severity, 'warn');
  assert.deepEqual(f.groups.map(({ size, signature, count }) => ({ size, signature, count })), [{ size: 13, signature: '.body-small', count: 1 }]);
  assert.match(f.message, /^1 text run below 14px: 13px × 1 \(\.body-small\)/);
});

test('ui-polish: tracked small text in an uncased script, or a price line, is not an eyebrow', { skip }, () => {
  const r = measure('controls-small-labels.html', ['--viewports', 'phone']);
  const [f] = loud(r.report, 'text-size');
  assert.ok(f, detail(r.report.findings));
  assert.equal(f.count, 2, 'both the CJK paragraph and the price line are small-text warnings');
  assert.ok(!r.report.findings.some((x) => x.check === 'text-size' && x.severity === 'info'), detail(r.report.findings));
});

test('ui-polish: a site-header heading does not introduce a scoped form', { skip }, () => {
  const r = measure('controls-site-header.html', ['--viewports', 'phone', '--scope', '#signup']);
  assert.deepEqual(r.report.findings.filter((f) => f.check === 'heading').map((f) => f.severity), ['warn']);
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
  assert.match(cmp.stdout, /^Fixed 0 · remaining 1 · new 0/, 'one small-text finding per viewport in both versions');
});

// ---- consolidation: one finding per cause

test('ui-polish: fields and controls that share a cause are one finding with their members', { skip }, () => {
  const r = measure('consolidate.html', ['--viewports', 'phone']);
  const inputs = r.report.findings.filter((f) => f.check === 'input-font-size');
  assert.equal(inputs.length, 1, detail(inputs));
  assert.match(inputs[0].message, /^2 fields use 15px text/);
  assert.equal(inputs[0].count, 2);
  assert.deepEqual(inputs[0].members.map((m) => m.anchor), ['#first', '#last']);
  const taps = r.report.findings.filter((f) => f.check === 'tap-target');
  assert.equal(taps.length, 1, detail(taps));
  assert.equal(taps[0].severity, 'error');
  assert.equal(taps[0].count, 2);
  assert.equal(taps[0].examples.length, 2);
});

test('ui-polish: small text is one finding per viewport with its groups', { skip }, () => {
  const r = measure('consolidate.html', ['--viewports', 'phone']);
  const text = r.report.findings.filter((f) => f.check === 'text-size');
  const warn = text.filter((f) => f.severity === 'warn');
  assert.equal(warn.length, 1, detail(text));
  assert.match(warn[0].message, /^3 text runs below 14px: 13px × 2 \(\.note\), 12px × 1 \(\.caption\)$/);
  assert.deepEqual(warn[0].groups.map(({ size, signature, count }) => ({ size, signature, count })), [{ size: 13, signature: '.note', count: 2 }, { size: 12, signature: '.caption', count: 1 }]);
  assert.ok(warn[0].groups.every((g) => g.examples.length >= 1 && g.examples.length <= 3));
  const info = text.filter((f) => f.severity === 'info');
  assert.equal(info.length, 1, 'eyebrow labels are one info finding');
  assert.ok(info[0].groups.every((g) => g.eyebrow === true));
});

test('ui-polish: a finding identical on phone and desktop is reported once', { skip }, () => {
  const r = measure('consolidate.html');
  const text = r.report.findings.filter((f) => f.check === 'text-size' && f.severity === 'warn');
  assert.equal(text.length, 1, detail(text));
  assert.deepEqual(text[0].viewports, ['phone', 'desktop']);
  assert.equal(text[0].viewport, 'phone', 'viewport stays the first one for older readers');
  const printed = r.stdout.split('\n').filter((l) => /\[warn\] \S+ text-size:/.test(l));
  assert.equal(printed.length, 1, r.stdout);
  assert.match(printed[0], /\[warn\] phone\+desktop text-size:/);
  const warnings = r.report.findings.filter((f) => f.severity === 'warn').length;
  assert.match(r.stdout, new RegExp(`· ${warnings} warnings ·`));

  // compare normalises both sides: the same findings split per viewport and per element are not "fixed"
  const split = { ...r.report, findings: [] };
  for (const f of r.report.findings) {
    for (const v of f.viewports) {
      for (const m of f.members || [f]) {
        const { viewports, members, count, examples, ...rest } = f;
        split.findings.push({ ...rest, viewport: v, selector: m.selector, anchor: m.anchor });
      }
    }
  }
  const old = join(work, 'split-measure.json');
  writeFileSync(old, JSON.stringify(split));
  const cmp = spawnSync(process.execPath, [script, '--compare', old, join(r.out, 'measure.json')], { encoding: 'utf8' });
  assert.match(cmp.stdout, /^Fixed 0 · remaining \d+ · new 0/, cmp.stdout);
});

// ---- command line, compare accounting, exit codes

test('ui-polish: an unknown option is a usage error, not a target', { skip }, () => {
  const r = measure('checkbox-label.html', ['--viewport', 'phone']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown option --viewport \(did you mean --viewports\?\)/);
  assert.equal(r.report, null);
});

test('ui-polish: --compare names the fixed members of a group and fails on a new error', { skip }, () => {
  const before = measure('compare-fix-before.html', ['--viewports', 'phone']);
  const after = measure('compare-fix-after.html', ['--viewports', 'phone']);
  const cmp = spawnSync(process.execPath, [script, '--compare', join(before.out, 'measure.json'), join(after.out, 'measure.json')], { encoding: 'utf8' });
  assert.equal(cmp.status, 1, cmp.stdout);
  const [, fixed, remaining, added] = cmp.stdout.match(/^Fixed (\d+) · remaining (\d+) · new (\d+)/).map(Number);
  assert.ok(fixed >= 1 && added >= 1 && remaining >= 1, cmp.stdout);
  assert.match(cmp.stdout, /Fixed:\n.*tap-target — 2 of 3 elements: [^\n]*second[^\n]*third/);
  assert.match(cmp.stdout, /New \(regressions\):[\s\S]*\[error\] phone tap-target[\s\S]*text-size — 1 text run below 14px: 12px × 1 \(\.fine\)/);
  assert.doesNotMatch(cmp.stdout.split('Remaining:')[1].split('New')[0], /3 controls/, 'the whole group is not repeated under Remaining');
});

test('ui-polish: several targets exit 1 on an error finding and 3 when a target fails to load', { skip }, () => {
  assert.equal(measure(['controls-bare-checkbox.html', 'controls-small-body.html'], ['--viewports', 'phone']).status, 1);
  const failed = measure(['controls-bare-checkbox.html', 'no-such-page.html'], ['--viewports', 'phone']);
  assert.equal(failed.status, 3, 'a failed target outranks an error finding');
  assert.match(failed.stdout, /run failed/);
});

test('ui-polish: config problems print the message without the usage banner, and broad rules warn', { skip }, () => {
  const bad = join(work, 'bad.json');
  writeFileSync(bad, '{bad');
  const r = measure('config-ignore.html', ['--config', bad]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /is not valid JSON/);
  assert.doesNotMatch(r.stderr, /Usage:/);
  const all = join(work, 'all.json');
  writeFileSync(all, JSON.stringify({ ignore: [{ selector: 'body', reason: 'testing a broad rule' }] }));
  const broad = measure('controls-bare-checkbox.html', ['--viewports', 'phone', '--config', all]);
  assert.equal(broad.status, 0, 'accepted findings do not fail the run');
  assert.match(broad.stdout, /Warning: config rule selector "body" matches the scope root or body\/html/);
  assert.match(broad.stdout, /Warning: config rule selector "body" accepts an error: tap-target/);
  assert.ok(broad.report.configWarnings.length >= 2);
});
