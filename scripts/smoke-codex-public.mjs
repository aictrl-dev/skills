#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXPECTED_SKILLS, PUBLIC_MCP_URL, ROOT } from './public-catalog.mjs';

const codexHome = mkdtempSync(join(tmpdir(), 'aictrl-codex-public-'));
const marketplaceRoot = join(codexHome, 'marketplace');
const codex = process.env.CODEX_BIN || 'codex';
const env = { ...process.env, CODEX_HOME: codexHome };
const pluginId = 'aictrl@aictrl-public';

try {
  for (const path of ['.agents', '.codex-plugin', '.mcp.json', 'assets', 'skills']) {
    cpSync(join(ROOT, path), join(marketplaceRoot, path), { recursive: true });
  }
  commitMarketplace('initial marketplace');

  run(['plugin', 'marketplace', 'add', marketplaceRoot]);
  assertIncludes(run(['plugin', 'marketplace', 'list']), 'aictrl-public', 'marketplace list');

  const sourceManifest = json(join(marketplaceRoot, '.codex-plugin/plugin.json'));
  run(['plugin', 'add', pluginId]);
  assertInstalled(sourceManifest.version);

  run(['plugin', 'add', pluginId]);
  assertInstalled(sourceManifest.version);

  const upgradeVersion = `${sourceManifest.version.split('-')[0]}-smoke.1`;
  writeFileSync(
    join(marketplaceRoot, '.codex-plugin/plugin.json'),
    `${JSON.stringify({ ...sourceManifest, version: upgradeVersion }, null, 2)}\n`,
  );
  commitMarketplace('upgrade marketplace');
  run(['plugin', 'add', pluginId]);
  assertInstalled(upgradeVersion);

  run(['plugin', 'remove', pluginId]);
  assertIncludes(run(['plugin', 'list']), 'not installed', 'plugin list after removal');

  const config = readFileSync(join(codexHome, 'config.toml'), 'utf8');
  if (config.includes(`[plugins."${pluginId}"]`)) {
    throw new Error('Codex removal left the AICtrl plugin enabled in config.toml');
  }
  assertIncludes(config, '[marketplaces.aictrl-public]', 'config after removal');

  console.log('Codex root marketplace lifecycle smoke passed.');
} finally {
  rmSync(codexHome, { recursive: true, force: true });
}

function assertInstalled(expectedVersion) {
  const listing = run(['plugin', 'list']);
  assertIncludes(listing, pluginId, 'installed plugin list');
  assertIncludes(listing, 'installed, enabled', 'installed plugin status');

  const installedRoot = join(codexHome, 'plugins/cache/aictrl-public/aictrl', expectedVersion);
  const installedManifest = json(join(installedRoot, '.codex-plugin/plugin.json'));
  if (installedManifest.name !== 'aictrl' || installedManifest.version !== expectedVersion) {
    throw new Error('Installed Codex manifest does not match the source package');
  }

  const installedMcp = json(join(installedRoot, '.mcp.json'));
  if (installedMcp.mcpServers?.aictrl?.url !== PUBLIC_MCP_URL) {
    throw new Error('Installed Codex plugin does not target the canonical public workflow endpoint');
  }

  const skillsRoot = join(installedRoot, 'skills');
  const installedSkills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(installedSkills) !== JSON.stringify(EXPECTED_SKILLS)) {
    throw new Error(`Installed Codex skills differ: ${installedSkills.join(', ')}`);
  }
  for (const skill of EXPECTED_SKILLS) {
    if (!existsSync(join(skillsRoot, skill, 'SKILL.md'))) {
      throw new Error(`Installed Codex skill is missing SKILL.md: ${skill}`);
    }
  }
}

function run(args) {
  try {
    return execFileSync(codex, args, {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() || '';
    const stdout = error?.stdout?.toString?.() || '';
    const detail = stderr.trim() || stdout.trim();
    throw new Error(`codex ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertIncludes(value, expected, context) {
  if (!value.includes(expected)) {
    throw new Error(`${context} did not include ${JSON.stringify(expected)}`);
  }
}

function commitMarketplace(message) {
  execFileSync('git', ['init', '--quiet'], { cwd: marketplaceRoot });
  execFileSync('git', ['add', '.'], { cwd: marketplaceRoot });
  execFileSync('git', [
    '-c', 'user.name=AICtrl Smoke',
    '-c', 'user.email=smoke@aictrl.dev',
    'commit', '--quiet', '-m', message,
  ], { cwd: marketplaceRoot });
}
