import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  EXPECTED_SKILLS,
  PUBLIC_MCP_URL,
  ROOT,
  listSkillNames,
  readJson,
} from '../scripts/public-catalog.mjs';

test('all public manifests consume one canonical skills and MCP tree', () => {
  const claude = readJson('.claude-plugin/plugin.json');
  const codex = readJson('.codex-plugin/plugin.json');
  const mcp = readJson('.mcp.json');
  const pkg = readJson('package.json');

  assert.deepEqual(listSkillNames(), EXPECTED_SKILLS);
  assert.equal(claude.skills, './skills/');
  assert.equal(codex.skills, './skills/');
  assert.equal(claude.mcpServers, './.mcp.json');
  assert.equal(codex.mcpServers, './.mcp.json');
  assert.equal(mcp.mcpServers.aictrl.url, PUBLIC_MCP_URL);
  assert.equal(claude.version, pkg.version);
  assert.equal(codex.version, pkg.version);
});

test('OpenCode install is idempotent and uninstall preserves unrelated state', () => {
  const temp = mkdtempSync(join(tmpdir(), 'aictrl-opencode-test-'));
  const configRoot = join(temp, 'config');
  const opencodeRoot = join(configRoot, 'opencode');
  const configFile = join(opencodeRoot, 'opencode.json');
  const unrelatedSkill = join(opencodeRoot, 'skills/unrelated/SKILL.md');
  const env = { ...process.env, XDG_CONFIG_HOME: configRoot, HOME: join(temp, 'home') };

  try {
    mkdirSync(join(opencodeRoot, 'skills/unrelated'), { recursive: true });
    writeFileSync(unrelatedSkill, '# Unrelated\n');
    writeFileSync(configFile, `${JSON.stringify({
      theme: 'system',
      mcp: { unrelated: { type: 'remote', url: 'https://example.com/mcp' } },
    }, null, 2)}\n`);

    runInstaller([], env);
    runInstaller([], env);

    const installed = JSON.parse(readFileSync(configFile, 'utf8'));
    assert.equal(installed.theme, 'system');
    assert.deepEqual(installed.mcp.unrelated, { type: 'remote', url: 'https://example.com/mcp' });
    assert.deepEqual(installed.mcp.aictrl, { type: 'remote', url: PUBLIC_MCP_URL, enabled: true });
    for (const skill of EXPECTED_SKILLS) {
      assert.equal(existsSync(join(opencodeRoot, 'skills', skill, 'SKILL.md')), true);
    }

    runInstaller(['--uninstall'], env);
    const uninstalled = JSON.parse(readFileSync(configFile, 'utf8'));
    assert.equal(uninstalled.theme, 'system');
    assert.deepEqual(uninstalled.mcp.unrelated, { type: 'remote', url: 'https://example.com/mcp' });
    assert.equal(uninstalled.mcp.aictrl, undefined);
    assert.equal(existsSync(unrelatedSkill), true);
    for (const skill of EXPECTED_SKILLS) {
      assert.equal(existsSync(join(opencodeRoot, 'skills', skill)), false);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('OpenCode project install stays inside the selected repository', () => {
  const temp = mkdtempSync(join(tmpdir(), 'aictrl-opencode-project-'));
  try {
    runInstaller(['--project', temp], process.env);
    const config = JSON.parse(readFileSync(join(temp, 'opencode.json'), 'utf8'));
    assert.equal(config.mcp.aictrl.url, PUBLIC_MCP_URL);
    for (const skill of EXPECTED_SKILLS) {
      assert.equal(existsSync(join(temp, '.opencode/skills', skill, 'SKILL.md')), true);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('OpenCode install fails closed on malformed existing configuration', () => {
  const temp = mkdtempSync(join(tmpdir(), 'aictrl-opencode-malformed-'));
  const configRoot = join(temp, 'config');
  const configFile = join(configRoot, 'opencode/opencode.json');
  try {
    mkdirSync(join(configRoot, 'opencode'), { recursive: true });
    writeFileSync(configFile, '{not-json\n');
    const result = spawnSync(process.execPath, [join(ROOT, 'opencode/bin/install.js')], {
      env: { ...process.env, XDG_CONFIG_HOME: configRoot, HOME: join(temp, 'home') },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Cannot parse/);
    assert.equal(readFileSync(configFile, 'utf8'), '{not-json\n');
    for (const skill of EXPECTED_SKILLS) {
      assert.equal(existsSync(join(configRoot, 'opencode/skills', skill)), false);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('OpenCode install rejects ambiguous arguments without writing state', () => {
  const temp = mkdtempSync(join(tmpdir(), 'aictrl-opencode-arguments-'));
  const configRoot = join(temp, 'config');
  try {
    const result = spawnSync(process.execPath, [
      join(ROOT, 'opencode/bin/install.js'), '--project', '--uninstall',
    ], {
      env: { ...process.env, XDG_CONFIG_HOME: configRoot, HOME: join(temp, 'home') },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--project requires a directory/);
    assert.equal(existsSync(configRoot), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('npm package contains every canonical skill and no repository-only files', () => {
  const result = JSON.parse(execFileSync('npm', [
    'pack', '.', '--dry-run', '--json', '--ignore-scripts',
  ], { cwd: ROOT, encoding: 'utf8' }));
  const paths = result[0].files.map((entry) => entry.path);

  assert(paths.includes('.mcp.json'));
  assert(paths.includes('opencode/bin/install.js'));
  for (const skill of EXPECTED_SKILLS) {
    assert(paths.includes(`skills/${skill}/SKILL.md`));
  }
  assert.equal(paths.some((path) => path.startsWith('evals/')), false);
  assert.equal(paths.some((path) => path.startsWith('test/')), false);
  assert.equal(paths.some((path) => path.startsWith('.claude-plugin/')), false);
  assert.equal(paths.some((path) => path.startsWith('.codex-plugin/')), false);
});

function runInstaller(args, env) {
  return execFileSync(process.execPath, [join(ROOT, 'opencode/bin/install.js'), ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
