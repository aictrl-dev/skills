import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';
import { extractMermaid, verifyMarkdown } from '../skills/explain-change/scripts/verify-mermaid.mjs';

const verifier = join(ROOT, 'skills/explain-change/scripts/verify-mermaid.mjs');
const fixtures = join(ROOT, 'test/fixtures/explain-change-mermaid');

function verify(name, env = process.env) {
  const result = spawnSync(process.execPath, [verifier, '--input', join(fixtures, name)], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });
  return {
    ...result,
    report: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

test('extracts Mermaid fences and reports an unterminated fence', () => {
  const extracted = extractMermaid('```mermaid\nflowchart TD\n  A --> B\n```\n');
  assert.equal(extracted.diagrams.length, 1);
  assert.equal(extracted.diagrams[0].startLine, 1);
  assert.deepEqual(extractMermaid('```mermaid\nflowchart TD\n').errors, [{
    index: 1,
    startLine: 1,
    code: 'UNTERMINATED_FENCE',
    error: 'Mermaid fence is not closed.',
    source: 'flowchart TD\n',
  }]);
});

test('skips renderer setup when no Mermaid blocks exist', () => {
  const result = verify('no-diagrams.md', { ...process.env, MERMAID_CLI: '/missing/mmdc' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, { valid: true, renderer: null, diagrams: [], failures: [] });
});

test('fails closed when the renderer is unavailable', () => {
  const result = verify('valid.md', { ...process.env, MERMAID_CLI: '/missing/mmdc' });
  assert.equal(result.status, 1);
  assert.equal(result.report.valid, false);
  assert.equal(result.report.failures[0].code, 'MISSING_RENDERER');
});

test('rejects remote or executable URIs before checking renderer availability', () => {
  const result = verify('unsafe.md', { ...process.env, MERMAID_CLI: '/missing/mmdc' });
  assert.equal(result.status, 1);
  assert.equal(result.report.renderer, null);
  assert.equal(result.report.diagrams[0].status, 'failed');
  assert.equal(result.report.failures[0].code, 'UNSAFE_DIAGRAM');
});

test('fails closed when a renderer exceeds the per-diagram timeout', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aictrl-mermaid-timeout-'));
  const binary = join(root, 'node_modules/.bin/mmdc');
  try {
    mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
    writeFileSync(binary, `#!/usr/bin/env node
if (process.argv.includes('--version')) process.exit(0);
setTimeout(() => {}, 1000);
`);
    chmodSync(binary, 0o755);
    const report = await verifyMarkdown(join(fixtures, 'valid.md'), { root, timeoutMs: 25 });
    assert.equal(report.valid, false);
    assert.equal(report.failures[0].code, 'RENDER_TIMEOUT');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('renders a valid Mermaid block to SVG', { skip: !existsSync(join(ROOT, 'node_modules/.bin/mmdc')) }, () => {
  const result = verify('valid.md', { ...process.env, MERMAID_ALLOW_NO_SANDBOX: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.valid, true);
  assert.equal(result.report.diagrams[0].status, 'rendered');
  assert.match(result.report.renderer, /^11\.16\.0$/);
});

test('reports invalid syntax without masking successful sibling diagrams', { skip: !existsSync(join(ROOT, 'node_modules/.bin/mmdc')) }, () => {
  const result = verify('multiple.md', { ...process.env, MERMAID_ALLOW_NO_SANDBOX: '1' });
  assert.equal(result.status, 1);
  assert.equal(result.report.diagrams[0].status, 'rendered');
  assert.equal(result.report.diagrams[1].status, 'failed');
  assert.equal(result.report.failures[0].code, 'RENDER_ERROR');
});
