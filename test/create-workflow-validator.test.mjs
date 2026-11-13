import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const validator = join(ROOT, 'skills/create-workflow/validate.mjs');
const examplesDir = join(dirname(validator), 'reference/examples');
const examples = readdirSync(examplesDir).filter((name) => name.endsWith('.yaml')).map((name) => join(examplesDir, name));
const npxArgs = ['--yes', '-p', 'ajv@8', '-p', 'js-yaml@4', '--', 'node'];
const setupDir = mkdtempSync(join(tmpdir(), 'workflow-validator-deps-'));
const setupCwd = join(setupDir, 'work');
const setupCache = join(setupDir, 'cache');
mkdirSync(setupCwd);
let dependencyModules;
let registryAvailable = false;

function cleanEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  return env;
}

before(() => {
  const env = cleanEnv({ npm_config_cache: setupCache });
  // One bounded registry probe; offline runs still exercise all hermetic tests.
  const probe = spawnSync('npm', ['ping', '--fetch-retries=0', '--fetch-timeout=3000'], {
    cwd: setupCwd, env, encoding: 'utf8', timeout: 5_000,
  });
  registryAvailable = probe.status === 0;
  if (!registryAvailable) return;
  // Fetch the real major-pinned packages once, without adding repo dependencies.
  const result = spawnSync('npx', [...npxArgs, '-e', `
    const { createRequire } = require('node:module');
    const { delimiter, dirname, resolve } = require('node:path');
    for (const entry of process.env.PATH.split(delimiter)) {
      const req = createRequire(resolve(entry, '..', '..', 'package.json'));
      try {
        req.resolve('ajv/dist/2020.js'); req.resolve('js-yaml');
        console.log(dirname(dirname(req.resolve('ajv/package.json'))));
        break;
      } catch {}
    }
  `], { cwd: setupCwd, env, encoding: 'utf8', timeout: 180_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  dependencyModules = result.stdout.trim();
  assert.ok(existsSync(join(dependencyModules, 'ajv/dist/2020.js')), result.stdout);
  assert.deepEqual(readdirSync(setupCwd), []);
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

function needsNpx(t) {
  if (registryAvailable) return false;
  t.skip('npm registry unavailable (offline probe); real npx dependencies required');
  return true;
}

function installDependencies(root) {
  const modules = join(root, 'node_modules');
  cpSync(dependencyModules, modules, { recursive: true });
  mkdirSync(join(modules, '.bin'), { recursive: true });
  return join(modules, '.bin');
}

// Resolution probes use local marker modules, never npm or its real cache.
function fixtureDependencies(root, { marker, label = 'loaded', yamlVersion = '4.1.0', parseMarker } = {}) {
  const modules = join(root, 'node_modules');
  mkdirSync(join(modules, '.bin'), { recursive: true });
  mkdirSync(join(modules, 'ajv/dist'), { recursive: true });
  mkdirSync(join(modules, 'js-yaml'), { recursive: true });
  const mark = marker ? `require('node:fs').writeFileSync(${JSON.stringify(marker)}, ${JSON.stringify(label)});` : '';
  writeFileSync(join(modules, 'ajv/dist/2020.js'), `${mark}
    module.exports = class Ajv {
      addSchema() {}
      compile() { return () => true; }
    };
`);
  writeFileSync(join(modules, 'js-yaml/package.json'), JSON.stringify({ version: yamlVersion, main: 'index.js' }));
  const parseMark = parseMarker ? `require('node:fs').writeFileSync(${JSON.stringify(parseMarker)}, 'parsed');` : '';
  writeFileSync(join(modules, 'js-yaml/index.js'), `exports.load = () => { ${parseMark} return {}; };
`);
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
  if (needsNpx(t)) return;
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

test('bundled workflow schemas do not use the format keyword', () => {
  for (const file of ['reference/workflow.schema.json', 'reference/v1/workflow.schema.json']) {
    const schema = readFileSync(join(dirname(validator), file), 'utf8');
    assert.doesNotMatch(schema, /"format"\s*:/, file);
  }
});

test('validator never loads a format extension', (t) => {
  const box = sandbox(t);
  fixtureDependencies(box.cwd);
  const marker = join(box.root, 'formats-loaded');
  const extension = join(box.cwd, 'node_modules/ajv-formats');
  mkdirSync(extension);
  writeFileSync(join(extension, 'index.js'),
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'loaded'); throw new Error('unused extension');\n`);
  assertValid(validate(box));
  assert.equal(existsSync(marker), false, 'the validator loaded an unused format extension');
});

test('validator prefers verified npx dependencies over different host marker modules', (t) => {
  const box = sandbox(t);
  const marker = join(box.root, 'dependency-source');
  fixtureDependencies(box.cwd, { marker, label: 'host' });
  const bin = fixtureDependencies(join(box.cache, '_npx', 'fixture'), { marker, label: 'npx' });
  assertValid(validate(box, [bin]));
  assert.equal(readFileSync(marker, 'utf8'), 'npx');
});

test('validator falls back to host dependencies when verified npx roots cannot resolve them', (t) => {
  const box = sandbox(t);
  const marker = join(box.root, 'dependency-source');
  fixtureDependencies(box.cwd, { marker, label: 'host' });
  const bin = join(box.cache, '_npx', 'empty/node_modules/.bin');
  mkdirSync(bin, { recursive: true });
  assertValid(validate(box, [bin]));
  assert.equal(readFileSync(marker, 'utf8'), 'host');
});

test('validator refuses host js-yaml v3 before loading a YAML document', (t) => {
  const box = sandbox(t);
  const parseMarker = join(box.root, 'unsafe-parsed');
  fixtureDependencies(box.cwd, { yamlVersion: '3.14.1', parseMarker });
  const result = validate(box);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /js-yaml.*(?:4 or (?:later|newer)|>= ?4|at least 4)/i);
  assert.match(result.stderr, /3\.14\.1/);
  assert.equal(existsSync(parseMarker), false, 'unsafe js-yaml v3 load() was called');
});

test('default npm cache follows the injected platform and LocalAppData', async () => {
  const { defaultNpmCache } = await import('../skills/create-workflow/validate-env.mjs');
  const home = join(tmpdir(), 'cache-home');
  const localAppData = join(tmpdir(), 'local-app-data');
  assert.equal(defaultNpmCache('win32', { LOCALAPPDATA: localAppData }, home), join(localAppData, 'npm-cache'));
  assert.equal(defaultNpmCache('win32', {}, home), join(home, 'AppData', 'Local', 'npm-cache'));
  assert.equal(defaultNpmCache('linux', { LOCALAPPDATA: localAppData }, home), join(home, '.npm'));
  assert.equal(defaultNpmCache('darwin', {}, home), join(home, '.npm'));
});

test('remediation hint uses Windows double quotes and doubles embedded quotes', async () => {
  const { remediationHint } = await import('../skills/create-workflow/validate-env.mjs');
  const script = String.raw`C:\skill "quoted"\validate.mjs`;
  const file = String.raw`C:\work\workflow "quoted".yaml`;
  assert.equal(remediationHint(script, file, 'win32'),
    String.raw`npx --yes -p ajv@8 -p js-yaml@4 -- node "C:\skill ""quoted""\validate.mjs" "C:\work\workflow ""quoted"".yaml"`);
});

test('remediation hint uses POSIX single quotes and escapes embedded apostrophes', async () => {
  const { remediationHint } = await import('../skills/create-workflow/validate-env.mjs');
  const script = "/skill 'quoted'/validate.mjs";
  const file = "workflow 'quoted'.yaml";
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  assert.equal(remediationHint(script, file, 'linux'),
    `npx --yes -p ajv@8 -p js-yaml@4 -- node ${quote(script)} ${quote(file)}`);
});

test('validator shell-quotes both remediation arguments without executing substitutions', (t) => {
  const box = sandbox(t);
  const scriptDir = join(box.root, "skill ' $(touch script-pwned) `touch script-backtick-pwned`");
  mkdirSync(scriptDir);
  const script = join(scriptDir, 'validate.mjs');
  cpSync(validator, script);
  cpSync(join(dirname(validator), 'validate-env.mjs'), join(scriptDir, 'validate-env.mjs'));
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

test('validator validates all examples with host ajv and js-yaml', (t) => {
  if (needsNpx(t)) return;
  const box = sandbox(t);
  installDependencies(box.cwd);
  for (const example of examples) assertValid(validate(box, [], example));
});

test('validator zero-install npx validates all examples without writing to the empty cwd', { timeout: 240_000 }, (t) => {
  if (needsNpx(t)) return;
  const box = sandbox(t);
  const env = cleanEnv({ npm_config_cache: box.cache });
  assert.ok(examples.length >= 4);
  for (const example of examples) {
    const result = spawnSync('npx', [...npxArgs, validator, example], {
      cwd: box.cwd, env, encoding: 'utf8', timeout: 180_000,
    });
    assertValid(result);
    assert.deepEqual(readdirSync(box.cwd), [], example);
  }
});

test('validator zero-install npx rejects a control with an optional code-review parameter', { timeout: 180_000 }, (t) => {
  if (needsNpx(t)) return;
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
    cwd: box.cwd, env: cleanEnv({ npm_config_cache: box.cache }), encoding: 'utf8', timeout: 180_000,
  });
  assert.equal(result.status, 1, result.stderr || result.error?.message);
  assert.match(result.stderr, /schema.*required.*must be equal to constant/);
  assert.deepEqual(readdirSync(box.cwd), []);
});


test('validator zero-install npx uses the platform default cache when explicitly enabled', { timeout: 180_000 }, (t) => {
  if (process.env.CW_TEST_DEFAULT_CACHE !== '1') {
    t.skip('set CW_TEST_DEFAULT_CACHE=1 to allow use of the real default npm cache');
    return;
  }
  if (needsNpx(t)) return;
  const box = sandbox(t);
  const env = cleanEnv();
  delete env.npm_config_cache;
  const result = spawnSync('npx', [...npxArgs, validator, examples[0]], {
    cwd: box.cwd, env, encoding: 'utf8', timeout: 180_000,
  });
  assertValid(result);
  assert.deepEqual(readdirSync(box.cwd), []);
});
