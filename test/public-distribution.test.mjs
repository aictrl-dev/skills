import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  EXPECTED_SKILLS,
  PUBLIC_MCP_URL,
  ROOT,
  listSkillNames,
  readJson,
} from '../scripts/public-catalog.mjs';

const CONTRACT_RUBRICS = [
  'skills/create-issue/reference/contract-impact.md',
  'skills/spec-review/reference/contract-impact.md',
];

test('all public manifests consume one canonical skills and MCP tree', () => {
  const claude = readJson('.claude-plugin/plugin.json');
  const codex = readJson('.codex-plugin/plugin.json');
  const mcp = readJson('.mcp.json');

  assert.deepEqual(listSkillNames(), EXPECTED_SKILLS);
  assert.equal(claude.skills, './skills/');
  assert.equal(codex.skills, './skills/');
  assert.equal(claude.mcpServers, './.mcp.json');
  assert.equal(codex.mcpServers, './.mcp.json');
  assert.equal(mcp.mcpServers.aictrl.url, PUBLIC_MCP_URL);
  assert.equal(codex.version, claude.version);
});

test('issue authoring and spec review ship matching standalone contract rubrics', () => {
  const [createRubric, reviewRubric] = CONTRACT_RUBRICS;
  const createIssue = readFileSync(join(ROOT, 'skills/create-issue/SKILL.md'), 'utf8');
  const specReview = readFileSync(join(ROOT, 'skills/spec-review/SKILL.md'), 'utf8');

  assert.equal(existsSync(join(ROOT, createRubric)), true);
  assert.equal(existsSync(join(ROOT, reviewRubric)), true);
  const createRubricContents = readFileSync(join(ROOT, createRubric), 'utf8');
  const reviewRubricContents = readFileSync(join(ROOT, reviewRubric), 'utf8');

  assert.ok(createRubricContents.length > 1_000);
  assert.match(createRubricContents, /^# Database and API Contract-Impact Rubric$/m);
  assert.match(createRubricContents, /^## Database contract$/m);
  assert.match(createRubricContents, /^## API contract$/m);
  assert.match(createRubricContents, /actual proposed artifact/);
  assert.match(createRubricContents, /focused repository-native diff/);
  assert.match(createRubricContents, /Mermaid `erDiagram`/);
  assert.match(createRubricContents, /`No ERD topology change\.`/);
  assert.equal(createRubricContents, reviewRubricContents);
  assert.match(createIssue, /\]\(reference\/contract-impact\.md\)/);
  assert.match(specReview, /\]\(reference\/contract-impact\.md\)/);
});
