import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT, readJson } from '../scripts/public-catalog.mjs';

const submission = (path) => readFileSync(join(ROOT, 'submission', path), 'utf8');

test('Codex reviewer pack contains exactly five positive and three negative cases', () => {
  const cases = submission('codex/test-cases.md');
  assert.equal(cases.match(/^### P\d+\b/gm)?.length, 5);
  assert.equal(cases.match(/^### N\d+\b/gm)?.length, 3);
  assert.match(cases, /aictrl-dev\/skills/);
  assert.match(cases, /aictrl-dev\/aictrl-plugin-reviewer-fixture/);
});

test('publication copy uses the unified repository and shared version', () => {
  const pkg = readJson('package.json');
  const listing = submission('codex/listing.md');
  const notes = submission('codex/release-notes.md');
  const ecosystem = submission('opencode/ecosystem.md');

  assert.match(listing, /root `skills\/` tree/);
  assert.match(listing, /https:\/\/aictrl\.dev\/mcp/);
  assert.match(notes, new RegExp(pkg.version.replaceAll('.', '\\.')));
  assert.match(notes, /Eleven portable/);
  assert.match(ecosystem, /https:\/\/github\.com\/aictrl-dev\/skills/);
  assert.doesNotMatch(ecosystem, /aictrl-dev\/aictrl-plugin\/tree/);
  for (const text of [listing, notes, ecosystem]) {
    assert.doesNotMatch(text, /plugins\/aictrl\/skills|eight generated skills/i);
  }
});

test('Codex submission requires the exact nine-tool public MCP catalog', () => {
  const listing = submission('codex/listing.md');
  const toolBlock = listing.match(
    /Require exactly these production tools:\n\n([\s\S]*?)\n\nScan again/,
  )?.[1];
  assert.ok(toolBlock, 'missing production tool allow-list');
  const tools = [...toolBlock.matchAll(/^\d+\. `([^`]+)`$/gm)]
    .map(([, tool]) => tool);

  assert.deepEqual(tools, [
    'list_organizations',
    'query_context',
    'update_backlog',
    'list_workflows',
    'get_workflow',
    'start_workflow',
    'get_workflow_run',
    'approve_workflow_step',
    'cancel_workflow_run',
  ]);
});

test('Codex reviewer fixture is dependency-free, passing, and leaves requested work absent', () => {
  const fixtureRoot = join(ROOT, 'submission/codex/fixture-template');
  const repositoryRoot = join(fixtureRoot, 'repository');
  const pkg = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.scripts, { test: 'node --test' });
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);

  const fixtureEnv = { ...process.env };
  delete fixtureEnv.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ['--test'], {
    cwd: repositoryRoot,
    env: fixtureEnv,
    encoding: 'utf8',
  });
  assert.match(output, /(?:#|ℹ)\s+pass 2/);
  assert.match(output, /(?:#|ℹ)\s+fail 0/);

  const source = readFileSync(join(repositoryRoot, 'src/labels.mjs'), 'utf8');
  const issue = readFileSync(join(fixtureRoot, 'issue.md'), 'utf8');
  assert.doesNotMatch(source, /normalizeLabel/);
  assert.match(issue, /Export `normalizeLabel\(label\)`/);
  assert.match(issue, /Do not merge or deploy/);
});
