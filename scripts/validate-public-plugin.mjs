#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXPECTED_SKILLS,
  PUBLIC_MCP_URL,
  ROOT,
  listSkillNames,
  readJson,
} from './public-catalog.mjs';

const errors = [];
const claude = readJson('.claude-plugin/plugin.json');
const claudeMarketplace = readJson('.claude-plugin/marketplace.json');
const codex = readJson('.codex-plugin/plugin.json');
const codexMarketplace = readJson('.agents/plugins/marketplace.json');
const mcp = readJson('.mcp.json');
const pkg = readJson('package.json');
const actualSkills = listSkillNames();
const versions = [
  ['package.json', pkg.version],
  ['Claude manifest', claude.version],
  ['Claude marketplace', claudeMarketplace.plugins?.[0]?.version],
  ['Codex manifest', codex.version],
];

check(versions.every(([, version]) => isVersion(version)), 'Every public package must have a valid semver version');
check(new Set(versions.map(([, version]) => version)).size === 1,
  `Public versions differ: ${versions.map(([name, version]) => `${name}=${version}`).join(', ')}`);
check(same(actualSkills, EXPECTED_SKILLS),
  `Public skill catalog differs: expected ${EXPECTED_SKILLS.join(', ')}; found ${actualSkills.join(', ')}`);

check(claude.name === 'aictrl', 'Claude plugin name must be aictrl');
check(claude.skills === './skills/', 'Claude plugin must use the root skills tree');
check(claude.mcpServers === './.mcp.json', 'Claude plugin must use the root MCP declaration');
check(claude.repository === 'https://github.com/aictrl-dev/skills', 'Claude repository URL is incorrect');
check(claudeMarketplace.name === 'aictrl-public', 'Claude marketplace name must be aictrl-public');
check(claudeMarketplace.plugins?.length === 1, 'Claude marketplace must expose exactly one plugin');
check(claudeMarketplace.plugins?.[0]?.name === 'aictrl', 'Claude marketplace plugin name must be aictrl');
check(claudeMarketplace.plugins?.[0]?.source === './', 'Claude marketplace must install the repository-root plugin');

check(codex.name === 'aictrl', 'Codex plugin name must be aictrl');
check(codex.skills === './skills/', 'Codex plugin must use the root skills tree');
check(codex.mcpServers === './.mcp.json', 'Codex plugin must use the root MCP declaration');
check(codex.repository === 'https://github.com/aictrl-dev/skills', 'Codex repository URL is incorrect');
check(codex.interface?.composerIcon === './assets/icon.svg', 'Codex composer icon must use the root asset');
check(codex.interface?.logo === './assets/icon.svg', 'Codex logo must use the root asset');
check(codexMarketplace.name === 'aictrl-public', 'Codex marketplace name must be aictrl-public');
check(codexMarketplace.plugins?.length === 1, 'Codex marketplace must expose exactly one plugin');
const codexEntry = codexMarketplace.plugins?.[0];
check(codexEntry?.name === 'aictrl', 'Codex marketplace plugin name must be aictrl');
check(codexEntry?.source?.source === 'url' && codexEntry.source.url === './',
  'Codex marketplace must install the repository-root plugin');
check(codexEntry?.policy?.installation === 'AVAILABLE', 'Codex installation policy must be AVAILABLE');
check(codexEntry?.policy?.authentication === 'ON_USE', 'Codex authentication policy must be ON_USE');

check(Object.keys(mcp.mcpServers || {}).length === 1, 'Root MCP declaration must contain exactly one server');
check(mcp.mcpServers?.aictrl?.type === 'http', 'Root aictrl MCP server must use HTTP');
check(mcp.mcpServers?.aictrl?.url === PUBLIC_MCP_URL,
  `Root aictrl MCP server must target ${PUBLIC_MCP_URL}`);

check(pkg.name === '@aictrl/opencode', 'OpenCode package name must be @aictrl/opencode');
check(pkg.bin?.['aictrl-opencode'] === 'opencode/bin/install.js', 'OpenCode package binary is incorrect');
for (const included of ['.mcp.json', 'skills', 'opencode/bin', 'README.md', 'LICENSE']) {
  check(pkg.files?.includes(included), `OpenCode package must include ${included}`);
}
check(pkg.publishConfig?.access === 'public', 'OpenCode package must publish publicly');
check(pkg.publishConfig?.tag === 'beta', 'Pre-release package must publish on the beta tag');

for (const duplicate of ['claude/aictrl/skills', 'plugins/aictrl/skills', 'opencode/skills']) {
  check(!existsSync(join(ROOT, duplicate)), `Generated skill mirror is forbidden: ${duplicate}`);
}
for (const required of [
  '.mcp.json',
  'assets/icon.svg',
  'opencode/bin/install.js',
  'submission/codex/listing.md',
  'submission/codex/readiness.md',
  'submission/codex/reviewer-fixture.md',
  'submission/codex/test-cases.md',
  'submission/opencode/ecosystem.md',
]) {
  check(existsSync(join(ROOT, required)), `Missing public plugin file: ${required}`);
}

const icon = readFileSync(join(ROOT, 'assets/icon.svg'), 'utf8');
check(icon.includes('<svg'), 'Codex icon must be SVG');
check(!/<(?:script|text|filter|foreignObject)\b/i.test(icon), 'Codex icon contains an unsupported SVG element');
check(!/(?:href|src)=["'](?:https?:|data:)/i.test(icon), 'Codex icon must not load external content');

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated one public plugin with ${actualSkills.length} canonical skills at version ${pkg.version}.`);

function check(condition, message) {
  if (!condition) errors.push(message);
}

function isVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
