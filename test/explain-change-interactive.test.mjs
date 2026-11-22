import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';
import { drawingTrees } from '../skills/explain-change/scripts/render-interactive.mjs';
import { cliPath, toolingPath } from '../skills/explain-change/scripts/verify-mermaid.mjs';

const script = join(ROOT, 'skills/explain-change/scripts/render-interactive.mjs');
const mmdc = cliPath();
const sourceLink = 'https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/src/jobs.ts#L24';
const code = 'return "</script><script>window.injected = true</script>";';
const steps = [
  { id: 'check', label: 'Check generation', summary: 'Compare the versions.' },
  { id: 'stop', label: 'Ignore stale job', summary: 'Return without writing.', outcome: 'fail',
    source: { label: 'src/jobs.ts:24', url: sourceLink, code } },
];

test('exports drawing presentation without SVG rules or animation elements', { skip: !existsSync(mmdc) }, async () => {
  const { default: puppeteer } = createRequire(join(toolingPath(), 'package.json'))('puppeteer');
  // The test harness supplies a local synthetic SVG and never renders a repository diagram.
  const testLauncher = { launch: options => puppeteer.launch({
    ...options, args: [...options.args, '--no-sandbox'],
  }) };
  const [drawing] = await drawingTrees([{ svg: `<svg xmlns="http://www.w3.org/2000/svg">
    <style>rect { fill: #15803d; }</style>
    <rect width="50" height="20" style="position: fixed; z-index: 10">
      <animate attributeName="opacity" values="0;1" dur="1s" />
    </rect>
  </svg>` }], testLauncher);
  const [, , , children] = drawing;
  const shapes = children.filter(Array.isArray);
  assert.deepEqual(shapes.map(shape => shape[1]), ['rect']);
  const [, , attributes, rectChildren, styles] = shapes[0];
  assert.equal(attributes.some(([, name]) => name === 'style'), false);
  assert.equal(rectChildren.some(Array.isArray), false);
  assert.equal(styles.some(([name]) => name === 'position' || name === 'z-index'), false);
  assert.equal(new Map(styles).get('fill'), 'rgb(21, 128, 61)');
});

test('exports a standalone walkthrough with working keyboard selection, source and trace', { skip: !existsSync(mmdc) }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aictrl-interactive-test-'));
  const input = join(dir, 'explainer.md');
  const sidecar = join(dir, 'steps.json');
  const output = join(dir, 'explain-change.html');
  const env = { ...process.env, MERMAID_CLI: mmdc, MERMAID_ALLOW_NO_SANDBOX: '1' };
  const args = [script, '--input', input, '--steps', sidecar, '--output', output];
  const { default: puppeteer } = createRequire(join(toolingPath(), 'package.json'))('puppeteer');
  try {
    writeFileSync(input, [
      '# Stale jobs', 'The comparison protects the record.', '',
      'Read the [pinned **source**](https://example.com/revision).', '',
      '<img src="https://example.com/tracker">', '',
      '````markdown', '```mermaid', 'Example syntax shown as text', '```', '````', '',
      '~~~mermaid', 'flowchart TD', '  check["Check generation"] --> stop["Ignore stale job"]', '~~~',
      '## Reviewer notes', 'Verify the exact line referenced from the diagram.',
    ].join('\n'));

    writeFileSync(sidecar, JSON.stringify([{ title: 'Stale path', steps, traces: [{ label: 'Stale job', steps: ['check', 'unknown'] }] }]));
    const invalid = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /invalid trace/);
    assert.equal(existsSync(output), false);

    writeFileSync(sidecar, JSON.stringify([{ title: 'Stale path', steps, traces: [{ label: 'Stale job', steps: ['check', 'stop'] }] }]));
    const exported = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    assert.equal(exported.status, 0, exported.stderr);
    assert.match(readFileSync(output, 'utf8'), /Content-Security-Policy/);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const requests = [];
      const errors = [];
      page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      page.on('pageerror', error => errors.push(error.message));
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(pathToFileURL(output).href);
      assert.equal(await page.$$eval('.explorer', nodes => nodes.length), 1);
      assert.equal(await page.$eval('main > pre', node => node.textContent.includes('Example syntax shown as text')), true);
      assert.equal(await page.$eval('main a strong', node => node.textContent), 'source');
      const stop = '[data-explore-step="stop"]';
      await page.waitForSelector(stop);
      await page.$eval(stop, node => node.focus());
      assert.equal(await page.evaluate(() => document.activeElement.dataset.exploreStep), 'stop');
      await page.keyboard.press('Enter');
      assert.equal(await page.$eval('.inspector code', node => node.textContent), code);
      assert.equal(await page.$eval('.inspector a', node => node.href), sourceLink);
      assert.equal(await page.evaluate(() => window.injected), undefined);
      await page.click('.traces button');
      assert.equal(await page.$$eval('.flowchart-link[data-on-path]', paths => paths.length), 1);
      const traceStyle = await page.$eval('.flowchart-link[data-on-path]', path => {
        const style = getComputedStyle(path);
        return { animation: style.animationName, dashes: style.strokeDasharray };
      });
      assert.equal(traceStyle.animation, 'none');
      assert.equal(traceStyle.dashes, '7px, 5px');
      await page.click('.traces button');
      assert.equal(await page.$$eval('.flowchart-link[data-on-path]', paths => paths.length), 0);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
