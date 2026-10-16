import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const skills = resolve('skills');
const expectedSkills = [
  'code-review', 'create-bug', 'create-issue', 'implement-code-change',
  'judge-review-findings', 'recording-product-demo', 'reply-to-code-review',
  'root-cause-analysis', 'spec-review',
];
const marker = '<!-- Evidence-authority mirror: change all nine copies together; checked by evidence-authority-mirror.test.mjs. -->';

test('the exact nine evidence-authority sections stay byte-identical and marked for synchronized edits', () => {
  const sections = new Map();
  for (const name of readdirSync(skills).sort()) {
    const text = readFileSync(join(skills, name, 'SKILL.md'), 'utf8');
    const matches = [...text.matchAll(/^## Evidence and authority\n[\s\S]*?(?=^## |(?![\s\S]))/gm)];
    if (!matches.length) continue;
    assert.equal(matches.length, 1, `${name}: expected one authority section`);
    sections.set(name, matches[0][0]);
  }
  assert.deepEqual([...sections.keys()], expectedSkills, 'authority policy membership changed; review the explicit nine-skill mirror');
  const canonical = sections.get(expectedSkills[0]);
  assert.ok(canonical.includes(marker), 'authority policy needs its synchronized-edit marker');
  for (const [name, section] of sections) {
    assert.equal(section, canonical, `${name}: authority policy differs from ${expectedSkills[0]}`);
  }
});
