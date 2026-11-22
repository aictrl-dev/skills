import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const script = join(ROOT, 'skills/explain-change/scripts/render-interactive.mjs');
const mmdc = join(ROOT, 'tooling/node_modules/.bin/mmdc');
const sourceLink = 'https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/src/jobs.ts#L24';
const code = 'return "</script><script>window.injected = true</script>";';
const steps = [
  { id: 'check', label: 'Check generation', summary: 'Compare the versions.' },
  { id: 'stop', label: 'Ignore stale job', summary: 'Return without writing.', outcome: 'fail',
    source: { label: 'src/jobs.ts:24', url: sourceLink, code } },
];

test('exports a standalone walkthrough with working keyboard selection, source and trace', { skip: !existsSync(mmdc) }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aictrl-interactive-test-'));
  const input = join(dir, 'explainer.md');
  const sidecar = join(dir, 'steps.json');
  const output = join(dir, 'explain-change.html');
  const env = { ...process.env, MERMAID_CLI: mmdc, MERMAID_ALLOW_NO_SANDBOX: '1' };
  const args = [script, '--input', input, '--steps', sidecar, '--output', output];
  const { default: puppeteer } = createRequire(join(ROOT, 'tooling/package.json'))('puppeteer');
  try {
    writeFileSync(input, [
      '# Stale jobs', 'The comparison protects the record.', '<img src="https://example.com/tracker">',
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
