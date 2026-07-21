import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { EXPECTED_SKILLS, ROOT, readJson } from '../scripts/public-catalog.mjs';

const submission = (path) => readFileSync(join(ROOT, 'submission', path), 'utf8');

const assertKnownIssuesAreNotes = (readiness) => {
  const knownIssueMarker = /\*\*Known(?: platform)? issue:\*\*/i;
  const knownIssueLines = readiness
    .split(/\r?\n/)
    .filter((line) => knownIssueMarker.test(line));

  assert.ok(knownIssueLines.length > 0, 'missing an explicitly labelled known-issue note');
  for (const line of knownIssueLines) {
    assert.match(
      line,
      /^\s*>\s+/,
      'known issues must be blockquote notes, not readiness controls',
    );
  }
};

test('Codex reviewer pack contains exactly five positive and three negative cases', () => {
  const cases = submission('codex/test-cases.md');
  assert.equal(cases.match(/^### P\d+\b/gm)?.length, 5);
  assert.equal(cases.match(/^### N\d+\b/gm)?.length, 3);
  assert.match(cases, /aictrl-dev\/aictrl-plugin-reviewer-fixture/);
  assert.match(cases, /List my aictrl\.dev organizations/);
  assert.match(cases, /search the connected code for implement-code-change/);
  assert.match(cases, /OpenAI plugin reviewer fixture task/);
  assert.match(cases, /openai-plugin-review-fixture-v1/);
  assert.doesNotMatch(
    cases,
    /Show me the evidence for the paused gate, then approve it\.|Cancel this active implementation run and show the retained result\./,
  );
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

test('Codex readiness records known platform defects as notes, not passed controls', () => {
  const readiness = submission('codex/readiness.md');
  assertKnownIssuesAreNotes(readiness);

  for (const checkedDefect of [
    '- [x] **Known platform issue:** aictrl-dev/aictrl#4100',
    '- [x] **Known issue:** https://github.com/aictrl-dev/aictrl/issues/4100',
  ]) {
    assert.throws(
      () => assertKnownIssuesAreNotes(checkedDefect),
      /known issues must be blockquote notes/,
    );
  }
});

test('GitHub social preview has reproducible source and upload dimensions', () => {
  const source = readFileSync(join(ROOT, 'assets/github-social-preview.svg'), 'utf8');
  const image = readFileSync(join(ROOT, 'assets/github-social-preview.png'));

  assert.match(source, /width="1280" height="640"/);
  assert.match(source, /Engineering skills/);
  assert.match(source, /Claude Code/);
  assert.match(source, /Codex/);
  assert.match(source, /OpenCode/);
  assert.match(source, new RegExp(`${EXPECTED_SKILLS.length} portable skills`));
  assert.equal(image.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(image.readUInt32BE(16), 1280);
  assert.equal(image.readUInt32BE(20), 640);
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
