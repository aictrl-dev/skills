#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXPECTED_SKILLS, PUBLIC_MCP_URL, ROOT } from './public-catalog.mjs';

const tempRoot = mkdtempSync(join(tmpdir(), 'aictrl-opencode-public-'));
const packDir = join(tempRoot, 'pack');
const configDir = join(tempRoot, 'config');
const dataDir = join(tempRoot, 'data');
const homeDir = join(tempRoot, 'home');
const npm = process.env.NPM_BIN || 'npm';
const opencode = process.env.OPENCODE_BIN || 'opencode';
const connectivityOrigin = process.env.AICTRL_OPENCODE_CONNECTIVITY_ORIGIN || 'https://aictrl.dev';
const connectivityUrl = new URL(new URL(PUBLIC_MCP_URL).pathname, connectivityOrigin).toString();
const configFile = join(configDir, 'opencode/opencode.json');
const skillsRoot = join(configDir, 'opencode/skills');
const env = {
  ...process.env,
  HOME: homeDir,
  XDG_CONFIG_HOME: configDir,
  XDG_DATA_HOME: dataDir,
};

try {
  mkdirSync(packDir, { recursive: true });
  const tarballName = run(npm, [
    'pack', '.', '--pack-destination', packDir, '--silent', '--ignore-scripts',
  ]).trim();
  if (!tarballName.endsWith('.tgz')) {
    throw new Error(`npm pack returned an unexpected filename: ${tarballName}`);
  }
  const tarball = join(packDir, tarballName);

  install(tarball);
  assertInstalled(PUBLIC_MCP_URL);

  install(tarball);
  assertInstalled(PUBLIC_MCP_URL);

  if (connectivityUrl !== PUBLIC_MCP_URL) {
    const config = jsonFile(configFile);
    config.mcp.aictrl.url = connectivityUrl;
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  }

  const listing = run(opencode, ['mcp', 'list']);
  if (!listing.includes('aictrl') || !listing.includes('needs authentication')) {
    throw new Error(`OpenCode did not reach the expected OAuth boundary:\n${listing.trim()}`);
  }
  if (listing.includes('failed')) {
    throw new Error(`OpenCode reported a failed MCP connection:\n${listing.trim()}`);
  }

  runPackage(tarball, ['--uninstall']);
  const afterUninstall = jsonFile(configFile);
  if (afterUninstall.mcp?.aictrl) {
    throw new Error('OpenCode uninstall left the AICtrl MCP entry configured');
  }
  for (const skill of EXPECTED_SKILLS) {
    if (existsSync(join(skillsRoot, skill))) {
      throw new Error(`OpenCode uninstall left an AICtrl skill installed: ${skill}`);
    }
  }

  console.log(`OpenCode public package lifecycle smoke passed against ${connectivityUrl}.`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function install(tarball) {
  runPackage(tarball, []);
}

function runPackage(tarball, args) {
  return run(npm, [
    'exec', '--yes', '--package', tarball, '--', 'aictrl-opencode', ...args,
  ]);
}

function assertInstalled(expectedUrl) {
  const config = jsonFile(configFile);
  if (config.$schema !== 'https://opencode.ai/config.json') {
    throw new Error('OpenCode package did not write the canonical schema URL');
  }
  if (
    config.mcp?.aictrl?.type !== 'remote'
    || config.mcp.aictrl.url !== expectedUrl
    || config.mcp.aictrl.enabled !== true
  ) {
    throw new Error('OpenCode package did not write the production OAuth MCP entry');
  }

  const installedSkills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(installedSkills) !== JSON.stringify(EXPECTED_SKILLS)) {
    throw new Error(`Installed OpenCode skills differ: ${installedSkills.join(', ')}`);
  }
  for (const skill of EXPECTED_SKILLS) {
    if (!existsSync(join(skillsRoot, skill, 'SKILL.md'))) {
      throw new Error(`Installed OpenCode skill is missing SKILL.md: ${skill}`);
    }
  }
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() || '';
    const stdout = error?.stdout?.toString?.() || '';
    const detail = stderr.trim() || stdout.trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

function jsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
