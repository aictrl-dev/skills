import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

// The Issue -> reviewed PR workflow repeats its safety rules word for word in
// every node prompt, because agents read only their own node's prompt. This
// test holds the single canonical text of each shared rule and fails if any
// copy drifts, in the canonical workflow or in the public create-workflow
// example (whose prompts must stay identical to the canonical ones).

const CANONICAL = '.aictrl/workflows/skills-implement-issue-from-ai-fix.yaml';
const EXAMPLE = 'skills/create-workflow/reference/examples/issue-to-reviewed-pr.yaml';

const FORM_CHECK =
  'the pull request targets main, has a head branch of the form ' +
  'ai-fix/<number>-<slug>, and has its head repository equal to its base ' +
  'repository (read `head.repo.full_name` and `base.repo.full_name` from ' +
  'the REST API), not a fork';

const TRIGGER_CHECK =
  'the triggering issue (read from the given issue URL) lists the pull ' +
  'request in its `closedByPullRequestsReferences` in GraphQL (query it ' +
  'with includeClosedPrs: true), the pull request is in the given ' +
  'repository, and its head branch starts with ai-fix/<issue-number>- ' +
  'for the triggering issue';

const BLOCKED_RULE =
  'Blocked-comment rule: post exactly one comment on the triggering issue ' +
  'of the form `Workflow blocked: <reason-code>`, where reason-code is one ' +
  'of pr-closed, pr-wrong-base, pr-branch-mismatch, pr-not-linked, ' +
  'pr-fork-head, pr-unreadable, duplicate-prs, branch-link-failed or ' +
  'step-failed. For duplicate-prs only, append the competing pull request ' +
  'numbers as plain digits. The comment must not contain any URL, must not ' +
  'link the pull request or contain the pr-url value, and must not quote or ' +
  'paste issue, pull request, branch or comment text.';

const EXPECTED = {
  'implement-issue': { form: true, trigger: false, blocked: true },
  review: { form: true, trigger: false, blocked: false },
  'triage-fix': { form: true, trigger: true, blocked: true },
  'notify-issue': { form: true, trigger: true, blocked: true },
};

// Minimal reader for the `prompt: >-` folded scalars these files use: lines
// are folded with single spaces and blank lines become paragraph breaks.
// No YAML dependency, so the test runs on the published package's devDeps.
function readPrompts(relativePath) {
  const lines = readFileSync(join(ROOT, relativePath), 'utf8').split('\n');
  const prompts = {};
  let nodeId;
  for (let i = 0; i < lines.length; i += 1) {
    const id = lines[i].match(/^\s*- id: ([a-z0-9-]+)\s*$/);
    if (id) nodeId = id[1];
    const key = lines[i].match(/^(\s*)prompt: >-\s*$/);
    if (!key) continue;
    const keyIndent = key[1].length;
    const paragraphs = [[]];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '') {
        paragraphs.push([]);
        continue;
      }
      if (line.length - line.trimStart().length <= keyIndent) break;
      paragraphs.at(-1).push(line.trim());
    }
    prompts[nodeId] = paragraphs
      .filter((p) => p.length > 0)
      .map((p) => p.join(' '))
      .join('\n');
    i = j - 1;
  }
  return prompts;
}

const count = (haystack, needle) => haystack.split(needle).length - 1;

for (const file of [CANONICAL, EXAMPLE]) {
  test(`${file}: shared prompt rules are word for word in every node`, () => {
    const prompts = readPrompts(file);
    assert.deepEqual(Object.keys(prompts).sort(), Object.keys(EXPECTED).sort());
    for (const [nodeId, want] of Object.entries(EXPECTED)) {
      const prompt = prompts[nodeId];
      assert.equal(count(prompt, FORM_CHECK), want.form ? 1 : 0, `${nodeId}: PR form check`);
      assert.equal(count(prompt, TRIGGER_CHECK), want.trigger ? 1 : 0, `${nodeId}: trigger check`);
      assert.equal(count(prompt, BLOCKED_RULE), want.blocked ? 1 : 0, `${nodeId}: blocked-comment rule`);
      assert.doesNotMatch(prompt, /pr-not-open|untrusted-author/, `${nodeId}: reason codes outside the shared vocabulary`);
    }
    // The review step never fails or comments on a failed check.
    assert.match(prompts.review, /record no findings and finish without failing and without commenting/);
  });
}

test('the create-workflow example keeps the canonical prompts unchanged', () => {
  assert.deepEqual(readPrompts(EXAMPLE), readPrompts(CANONICAL));
});
