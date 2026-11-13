import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const validator = join(ROOT, 'skills/create-workflow/validate.mjs');
const examplesDir = join(dirname(validator), 'reference/examples');
const examples = readdirSync(examplesDir).filter((name) => name.endsWith('.yaml')).map((name) => join(examplesDir, name));
const npxArgs = ['--yes', '-p', 'ajv@8', '-p', 'ajv-formats@3', '-p', 'js-yaml@4', '--', 'node'];
const setupDir = mkdtempSync(join(tmpdir(), 'workflow-validator-deps-'));
let dependencyModules;

function cleanEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  return env;
}

before(() => {
  // Fetch the real major-pinned packages once, without adding repo dependencies.
  const result = spawnSync('npx', [...npxArgs, '-e', `
    const { createRequire } = require('node:module');
    const { delimiter, dirname, resolve } = require('node:path');
    for (const entry of process.env.PATH.split(delimiter)) {
      const req = createRequire(resolve(entry, '..', '..', 'package.json'));
      try {
        req.resolve('ajv/dist/2020.js'); req.resolve('ajv-formats'); req.resolve('js-yaml');
        console.log(dirname(dirname(req.resolve('ajv/package.json'))));
        break;
      } catch {}
    }
  `], { cwd: setupDir, env: cleanEnv(), encoding: 'utf8', timeout: 180_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  dependencyModules = result.stdout.trim();
  assert.ok(existsSync(join(dependencyModules, 'ajv/dist/2020.js')), result.stdout);
  assert.deepEqual(readdirSync(setupDir), []);
});

after(() => rmSync(setupDir, { recursive: true, force: true }));

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'workflow-validator-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'work');
  const cache = join(root, 'cache');
  mkdirSync(cwd);
  mkdirSync(cache);
  return { root, cwd, cache };
}

function installDependencies(root, { formats = true } = {}) {
  const modules = join(root, 'node_modules');
  cpSync(dependencyModules, modules, {
    recursive: true,
    filter: (source) => formats || source !== join(dependencyModules, 'ajv-formats'),
  });
  mkdirSync(join(modules, '.bin'), { recursive: true });
  return join(modules, '.bin');
}

function trap(root, marker) {
  const modules = join(root, 'node_modules');
  mkdirSync(join(modules, '.bin'), { recursive: true });
  mkdirSync(join(modules, 'ajv/dist'), { recursive: true });
  writeFileSync(join(modules, 'ajv/dist/2020.js'),
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'loaded'); throw new Error('trap loaded');\n`);
  return join(modules, '.bin');
}

function validate(box, pathEntries = [], file = examples[0], script = validator) {
  return spawnSync(process.execPath, [script, file], {
    cwd: box.cwd,
    env: cleanEnv({ npm_config_cache: box.cache, PATH: pathEntries.join(delimiter) }),
    encoding: 'utf8',
    timeout: 20_000,
  });
}

function assertValid(result) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /schema-valid \(layer 1\) and passes static DAG checks/);
}

test('validator ignores a trap module in an arbitrary PATH node_modules/.bin', (t) => {
  const box = sandbox(t);
  const marker = join(box.root, 'untrusted-loaded');
  const bin = trap(join(box.root, 'untrusted'), marker);
  const result = validate(box, [bin]);
  assert.equal(existsSync(marker), false, 'arbitrary PATH trap module was loaded');
  assert.equal(result.status, 2, result.stderr);
});

test('validator uses dependencies inside npm_config_cache/_npx', (t) => {
  const box = sandbox(t);
  const bin = installDependencies(join(box.cache, '_npx', 'fixture'));
  assertValid(validate(box, [bin]));
});

test('validator rejects PATH symlinks that escape the npx cache', (t) => {
  const box = sandbox(t);
  const marker = join(box.root, 'symlink-loaded');
  const outside = join(box.root, 'outside');
  trap(outside, marker);
  mkdirSync(join(box.cache, '_npx'), { recursive: true });
  symlinkSync(outside, join(box.cache, '_npx', 'escape'), 'dir');
  const result = validate(box, [join(box.cache, '_npx', 'escape/node_modules/.bin')]);
  assert.equal(existsSync(marker), false, 'symlink escape trap module was loaded');
  assert.equal(result.status, 2, result.stderr);
});

test('validator rejects PATH dot-dot escapes and npx cache prefix siblings', (t) => {
  const box = sandbox(t);
  const marker = join(box.root, 'dotdot-loaded');
  const bin = trap(join(box.cache, '_npx-sibling'), marker);
  mkdirSync(join(box.cache, '_npx'), { recursive: true });
  for (const entry of [bin, `${box.cache}/_npx/../_npx-sibling/node_modules/.bin`]) {
    const result = validate(box, [entry]);
    assert.equal(existsSync(marker), false, 'dot-dot/prefix escape trap module was loaded');
    assert.equal(result.status, 2, result.stderr);
  }
});

test('validator prefers existing host dependencies over the npx cache', (t) => {
  const box = sandbox(t);
  installDependencies(box.cwd);
  const marker = join(box.root, 'cache-loaded');
  const bin = trap(join(box.cache, '_npx', 'fixture'), marker);
  assertValid(validate(box, [bin]));
  assert.equal(existsSync(marker), false);
});

test('validator shell-quotes both remediation arguments without executing substitutions', (t) => {
  const box = sandbox(t);
  const scriptDir = join(box.root, "skill ' $(touch script-pwned) `touch script-backtick-pwned`");
  mkdirSync(scriptDir);
  const script = join(scriptDir, 'validate.mjs');
  cpSync(validator, script);
  const file = "workflow ' $(touch pwned) `touch backtick-pwned`.yaml";
  const result = validate(box, [], file, script);
  assert.equal(result.status, 2, result.stderr);
  const hint = result.stderr.split('\n').find((line) => line.startsWith('  npx '))?.trim();
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  assert.equal(hint, `npx ${npxArgs.slice(0, -1).join(' ')} node ${quote(script)} ${quote(file)}`);
  const syntax = spawnSync('/bin/sh', ['-n', '-c', hint], { cwd: box.cwd, encoding: 'utf8', timeout: 5_000 });
  assert.equal(syntax.status, 0, syntax.stderr);
  const printed = spawnSync('/bin/sh', ['-c', `npx() { printf '%s\\n' "$@"; }; ${hint}`], {
    cwd: box.cwd, encoding: 'utf8', timeout: 5_000,
  });
  assert.equal(printed.status, 0, printed.stderr);
  assert.deepEqual(printed.stdout.trimEnd().split('\n').slice(-2), [script, file]);
  assert.deepEqual(readdirSync(box.cwd), [], 'the printed hint executed a substitution');
});

test('validator validates all examples with host ajv and js-yaml but no ajv-formats', (t) => {
  const box = sandbox(t);
  installDependencies(box.cwd, { formats: false });
  const require = createRequire(join(box.cwd, 'package.json'));
  assert.throws(() => require.resolve('ajv-formats'), { code: 'MODULE_NOT_FOUND' });
  for (const example of examples) assertValid(validate(box, [], example));
});

test('validator zero-install npx validates all four examples without writing to the empty cwd', { timeout: 240_000 }, (t) => {
  const box = sandbox(t);
  const env = cleanEnv();
  delete env.npm_config_cache; // Exercise npm's default ~/.npm cache.
  assert.equal(examples.length, 4);
  for (const example of examples) {
    const result = spawnSync('npx', [...npxArgs, validator, example], {
      cwd: box.cwd, env, encoding: 'utf8', timeout: 180_000,
    });
    assertValid(result);
    assert.deepEqual(readdirSync(box.cwd), [], example);
  }
});

test('validator zero-install npx rejects a control with an optional code-review parameter', { timeout: 180_000 }, (t) => {
  const box = sandbox(t);
  const require = createRequire(join(dependencyModules, '..', 'package.json'));
  const yaml = require('js-yaml');
  const source = join(examplesDir, 'issue-to-reviewed-pr.yaml');
  const doc = yaml.load(require('node:fs').readFileSync(source, 'utf8'));
  function makeReviewOptional(nodes) {
    for (const node of nodes) {
      if (node.taskType === 'code-review') { node.parameters[0].required = false; return true; }
      if (node.body?.nodes && makeReviewOptional(node.body.nodes)) return true;
    }
    return false;
  }
  assert.equal(makeReviewOptional(doc.nodes), true);
  const control = join(box.root, 'invalid-control.yaml');
  writeFileSync(control, yaml.dump(doc));
  const result = spawnSync('npx', [...npxArgs, validator, control], {
    cwd: box.cwd, env: cleanEnv(), encoding: 'utf8', timeout: 180_000,
  });
  assert.equal(result.status, 1, result.stderr || result.error?.message);
  assert.match(result.stderr, /schema.*required.*must be equal to constant/);
  assert.deepEqual(readdirSync(box.cwd), []);
});
