import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const fixtureRoot = join(ROOT, 'evals/fixtures/create-workflow');
const expectedDirectory = join(fixtureRoot, 'expected');
const expectedWorkflows = [
  'comment-triggered-review.yaml',
  'fix-regression.yaml',
  'implement-issue.yaml',
  'review-and-triage.yaml',
  'review-fix-loop.yaml',
];

test('create-workflow eval ships five distinct v2 authoring tasks and shapes', () => {
  const tasks = readFileSync(join(fixtureRoot, 'tasks.md'), 'utf8');
  const workflows = readdirSync(expectedDirectory).filter((name) => name.endsWith('.yaml')).sort();
  const taskNumbers = [...tasks.matchAll(/^## CW([1-5])\b/gm)].map((match) => match[1]).sort();

  assert.deepEqual(workflows, expectedWorkflows);
  assert.deepEqual(taskNumbers, ['1', '2', '3', '4', '5']);
  assert.match(tasks, /Do not publish, start, commit, push,\s*merge, or deploy anything/);

  for (const workflow of workflows) {
    const contents = readFileSync(join(expectedDirectory, workflow), 'utf8');
    assert.match(contents, /^schemaVersion: aictrl\/workflow\/v2$/m);
    assert.match(contents, /^name: [a-z0-9-]+$/m);
    assert.match(contents, /^nodes:$/m);
  }
});

test('create-workflow guide matches the v2 one-trigger schema and fails closed without publication tools', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'skills/create-workflow/reference/workflow.schema.json'), 'utf8'));
  const guide = readFileSync(join(ROOT, 'skills/create-workflow/reference/authoring-guide.md'), 'utf8');
  const skill = readFileSync(join(ROOT, 'skills/create-workflow/SKILL.md'), 'utf8');

  assert.equal(schema.properties.triggers.maxItems, 1);
  assert.match(guide, /at most one file-declared event trigger/);
  assert.match(guide, /at most \*\*one\*\* file trigger/);
  assert.doesNotMatch(guide, /up to \*\*10\*\* file triggers|At most 10 entries in `triggers`/);
  assert.match(skill, /publication unavailable/);
  assert.match(skill, /Never guess a tool name, make a raw HTTP call/);
});
