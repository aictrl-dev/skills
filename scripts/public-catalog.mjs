import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_MCP_URL = 'https://aictrl.dev/mcp';
export const PUBLIC_MCP_ANNOTATIONS = Object.freeze({
  read: Object.freeze({ readOnlyHint: true, destructiveHint: false, openWorldHint: false }),
  update: Object.freeze({ readOnlyHint: false, destructiveHint: true, openWorldHint: false }),
  readIdempotent: Object.freeze({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }),
  readOpenWorld: Object.freeze({ readOnlyHint: true, destructiveHint: false, openWorldHint: true }),
  readOpenWorldIdempotent: Object.freeze({ readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true }),
  createIdempotent: Object.freeze({ readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: true }),
});
export const EXPECTED_PUBLIC_MCP_TOOLS = Object.freeze([
  'query_context',
  'update_backlog',
  'list_organizations',
  'list_workflows',
  'get_workflow',
  'start_workflow',
  'get_workflow_run',
  'approve_workflow_step',
  'cancel_workflow_run',
  'list_tasks',
  'start_task',
  'get_task_execution',
  'get_started',
]);
export const EXPECTED_SKILLS = Object.freeze([
  'code-review',
  'create-bug',
  'create-issue',
  'create-pr',
  'create-workflow',
  'design-review',
  'execute-workflow',
  'explain-change',
  'implement-code-change',
  'judge-review-findings',
  'measurement-plan',
  'recording-product-demo',
  'reply-to-code-review',
  'root-cause-analysis',
  'spec-review',
  'ui-polish',
  'ux-testing',
]);

export function listSkillNames(root = ROOT) {
  const skillsRoot = join(root, 'skills');
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
}

export function readJson(relativePath, root = ROOT) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}
