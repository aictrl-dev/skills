import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = fileURLToPath(new URL('../skills/recording-product-demo/scripts/', import.meta.url));
const scripts = ['login.cjs', 'scrape-text.cjs', 'record-demo.cjs'];
const marker = (text) => `process.stdout.write(${JSON.stringify(text)}); process.exit(23);`;

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'demo-dependencies-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skill = path.join(root, 'trusted-skill');
  const target = path.join(root, 'target');
  cpSync(source, path.join(skill, 'scripts'), { recursive: true });
  mkdirSync(path.join(target, 'demo/out/voice'), { recursive: true });
  writeFileSync(path.join(target, 'demo/demo.config.json'), '{}');
  writeFileSync(path.join(target, 'demo/out/voice/timeline.json'), '[{"start":0,"end":1}]');
  return {
    root, skill, target,
    install(base, name, code) {
      const dir = path.join(base, 'node_modules', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'index.js'), code);
      return path.join(base, 'node_modules');
    },
    run(script, nodePath = '', args = null) {
      const defaults = script === 'login.cjs' ? ['--url', 'https://example.test', '--expect', 'Logged in']
        : script === 'scrape-text.cjs' ? ['https://example.test'] : [];
      return spawnSync(process.execPath, [path.join(skill, 'scripts', script), ...(args ?? defaults)], {
        cwd: target, encoding: 'utf8', timeout: 5000,
        env: { ...process.env, NODE_PATH: nodePath, NODE_OPTIONS: '', HOME: root },
      });
    },
  };
}

for (const script of scripts) {
  test(`${script}: target CWD cannot override explicitly trusted NODE_PATH`, (t) => {
    const f = fixture(t);
    f.install(f.target, 'playwright', marker('UNTRUSTED_CWD_EXECUTED'));
    const nodePath = f.install(path.join(f.root, 'operator-dependencies'), 'playwright', marker('TRUSTED_NODE_PATH_LOADED'));
    const r = f.run(script, nodePath);
    assert.equal(r.error, undefined);
    assert.doesNotMatch(r.stdout, /UNTRUSTED_CWD_EXECUTED/);
    assert.equal(r.status, 23, r.stderr);
    assert.match(r.stdout, /TRUSTED_NODE_PATH_LOADED/);
  });

  test(`${script}: supports an installation beside the skill`, (t) => {
    const f = fixture(t);
    f.install(f.skill, 'playwright', marker('TRUSTED_SKILL_LOADED'));
    const r = f.run(script);
    assert.equal(r.status, 23, r.stderr);
    assert.match(r.stdout, /TRUSTED_SKILL_LOADED/);
  });

  test(`${script}: absent playwright can use trusted playwright-core`, (t) => {
    const f = fixture(t);
    const nodePath = f.install(path.join(f.root, 'operator-dependencies'), 'playwright-core', marker('TRUSTED_CORE_LOADED'));
    const r = f.run(script, nodePath);
    assert.equal(r.status, 23, r.stderr);
    assert.match(r.stdout, /TRUSTED_CORE_LOADED/);
  });

  test(`${script}: missing packages report trusted setup guidance without loading CWD`, (t) => {
    const f = fixture(t);
    f.install(f.target, 'playwright', marker('UNTRUSTED_CWD_EXECUTED'));
    const r = f.run(script);
    assert.doesNotMatch(r.stdout, /UNTRUSTED_CWD_EXECUTED/);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /NODE_PATH/);
    assert.match(r.stderr, /trust/);
    assert.match(r.stderr, /playwright install chromium/);
  });

  for (const [kind, code, error] of [
    ['initialization error', "throw new Error('BROKEN_PLAYWRIGHT_INITIALIZATION')", /BROKEN_PLAYWRIGHT_INITIALIZATION/],
    ['missing internal dependency', "require('missing-playwright-internal-fixture')", /Cannot find module 'missing-playwright-internal-fixture'/],
  ]) {
    test(`${script}: preserves ${kind} instead of falling back`, (t) => {
      const f = fixture(t);
      f.install(f.skill, 'playwright', code);
      f.install(f.skill, 'playwright-core', marker('FALLBACK_EXECUTED'));
      const nodePath = f.install(path.join(f.root, 'operator-dependencies'), 'playwright', marker('FALLBACK_EXECUTED'));
      const r = f.run(script, nodePath);
      assert.notEqual(r.status, 0);
      assert.doesNotMatch(r.stdout, /FALLBACK_EXECUTED/);
      assert.match(r.stderr, error);
      assert.doesNotMatch(r.stderr, /Playwright was not found/);
    });
  }
}

for (const script of ['login.cjs', 'scrape-text.cjs']) {
  test(`${script}: validates usage before loading even a trusted dependency`, (t) => {
    const f = fixture(t);
    f.install(f.skill, 'playwright', marker('DEPENDENCY_LOADED'));
    const r = f.run(script, '', []);
    assert.equal(r.status, 64, r.stderr);
    assert.match(r.stderr, /Usage:/);
    assert.doesNotMatch(r.stdout, /DEPENDENCY_LOADED/);
  });
}
