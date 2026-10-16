import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const script = path.join(ROOT, 'skills/recording-product-demo/scripts/login.cjs');
const skip = process.platform === 'win32' ? 'POSIX permissions are not Windows ACL guarantees' : false;
const preload = String.raw`
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const root = process.env.SESSION_TEST_ROOT;
const observations = { writes: [], launches: [], closed: false, removals: [] };
const originalWrite = fs.writeFileSync;
const originalOpen = fs.openSync;
const originalStat = fs.lstatSync;
const originalRemove = fs.rmSync;
const descriptors = new Map();
process.umask(Number.parseInt(process.env.SESSION_UMASK || '0', 8));
fs.openSync = function(file, ...args) {
  const fd = originalOpen.call(this, file, ...args);
  descriptors.set(fd, String(file));
  return fd;
};
fs.lstatSync = function(file, ...args) {
  const stat = originalStat.call(this, file, ...args);
  if (process.env.SESSION_FOREIGN_PATH === String(file)) {
    Object.defineProperty(stat, 'uid', { value: process.getuid() + 1 });
  }
  return stat;
};
fs.writeFileSync = function(file, data, ...args) {
  const name = typeof file === 'number' ? descriptors.get(file) : String(file);
  const sensitive = name && !name.endsWith('observations.json') &&
    (name.includes('auth-state') || name.includes('.session-'));
  if (sensitive && process.env.SESSION_FAIL_WRITE) throw new Error('synthetic persistence failure');
  const result = originalWrite.call(this, file, data, ...args);
  if (sensitive) {
    const stat = typeof file === 'number' ? fs.fstatSync(file) : fs.statSync(file);
    observations.writes.push({ name, mode: stat.mode & 0o777 });
  }
  return result;
};
fs.rmSync = function(file, ...args) {
  if (String(file).includes('.session-')) {
    observations.removals.push(String(file));
    if (process.env.SESSION_FAIL_CLEANUP) throw new Error('synthetic cleanup failure');
  }
  return originalRemove.call(this, file, ...args);
};
process.on('exit', () => {
  process.umask(0); // observation output must stay readable even under an owner-restrictive umask
  originalWrite(path.join(root, 'observations.json'), JSON.stringify(observations), { mode: 0o600 });
});
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  if (name === 'playwright') return path.join(root, 'trusted-playwright.cjs');
  return originalResolve.call(this, name, ...args);
};
Module._load = function(name, ...args) {
  if (name === 'playwright' || name.endsWith('/node_modules/playwright') || name === path.join(root, 'trusted-playwright.cjs')) {
    return { chromium: { async launchPersistentContext(profile) {
      observations.launches.push({ profile, mode: fs.existsSync(profile) ? fs.statSync(profile).mode & 0o777 : null });
      const page = {
        async goto() {},
        isClosed() { return Boolean(process.env.SESSION_CLOSED); },
        locator() { return { first() { return { async isVisible() {
          if (process.env.SESSION_CLOSED) throw new Error('synthetic closed window');
          if (process.env.SESSION_FAIL_LOCATOR) throw new Error('synthetic locator failure');
          return true;
        } }; } }; }
      };
      return {
        pages() { return [page]; },
        async storageState(options) {
          const state = { cookies: [{ name: 'demo', value: 'SYNTHETIC_SESSION_SECRET' }], origins: [] };
          if (options && options.path) {
            fs.mkdirSync(path.dirname(options.path), { recursive: true });
            fs.writeFileSync(options.path, JSON.stringify(state));
          }
          return state;
        },
        async close() { observations.closed = true; if (process.env.SESSION_FAIL_CLOSE) throw new Error('synthetic browser close failure'); }
      };
    } } };
  }
  return originalLoad.call(this, name, ...args);
};
const originalTimeout = global.setTimeout;
global.setTimeout = (fn) => originalTimeout(fn, 0);
`;

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-private-session-'));
  fs.chmodSync(root, 0o755); // shared ancestor: helper must never change it
  const hook = path.join(root, 'preload.cjs');
  fs.writeFileSync(hook, preload);
  const profile = path.join(root, 'private', 'chrome-profile');
  const state = path.join(root, 'private', 'auth-state.json');
  function run(extraEnv = {}, overrides = {}) {
    const result = spawnSync(process.execPath, ['--require', hook, script,
      '--url', 'https://demo.invalid', '--expect', 'Sign out',
      '--profile', overrides.profile || profile, '--state', overrides.state || state,
      '--timeout-min', overrides.timeoutMin || '0.001'], {
      cwd: root, encoding: 'utf8', timeout: 15000,
      env: { PATH: '', HOME: root, NODE_PATH: '', NODE_OPTIONS: '', SESSION_TEST_ROOT: root, ...extraEnv },
    });
    const observed = JSON.parse(fs.readFileSync(path.join(root, 'observations.json'), 'utf8'));
    assert.ok(!result.stdout.includes('SYNTHETIC_SESSION_SECRET'));
    assert.ok(!result.stderr.includes('SYNTHETIC_SESSION_SECRET'));
    return { ...result, observed };
  }
  try { fn({ root, profile, state, run }); }
  finally {
    // Failed old implementations can leave a newly created directory without owner bits.
    // Repair only these test-owned paths so a red regression cannot strand its fixture.
    for (const dir of [path.dirname(state), profile]) {
      if (fs.existsSync(dir) && !fs.lstatSync(dir).isSymbolicLink()) fs.chmodSync(dir, 0o700);
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('demo sessions: private directories and first state write under umask 000', { skip }, () => fixture(({ root, profile, state, run }) => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.observed.launches[0].mode, 0o700, 'profile must be private before browser launch');
  assert.ok(result.observed.writes.length > 0);
  assert.ok(result.observed.writes.every(write => write.mode === 0o600), 'every initial write must be private');
  assert.equal(fs.statSync(path.dirname(state)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(profile).mode & 0o777, 0o700);
  assert.equal(fs.statSync(state).mode & 0o777, 0o600);
  assert.equal(fs.statSync(root).mode & 0o777, 0o755);
  assert.equal(result.observed.closed, true);
}));

test('demo sessions: atomically replace an existing state without a permissive write', { skip }, () => fixture(({ state, run }) => {
  fs.mkdirSync(path.dirname(state), { mode: 0o700 });
  fs.writeFileSync(state, '{"old":true}', { mode: 0o600 });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.observed.writes.length > 0);
  assert.ok(result.observed.writes.every(write => write.mode === 0o600));
  assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).cookies[0].name, 'demo');
}));

test('demo sessions: reject non-private existing directories without chmod', { skip }, () => fixture(({ root, profile, run }) => {
  fs.mkdirSync(profile, { recursive: true });
  fs.chmodSync(profile, 0o755);
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private|0700|700/i);
  assert.equal(result.observed.launches.length, 0);
  assert.equal(fs.statSync(profile).mode & 0o777, 0o755);
  assert.equal(fs.statSync(root).mode & 0o777, 0o755);
}));

for (const kind of ['state', 'profile', 'ancestor']) {
  test(`demo sessions: reject ${kind} symlink without touching its target`, { skip }, () => fixture(({ root, profile, state, run }) => {
    const target = path.join(root, 'unrelated');
    fs.mkdirSync(target, { mode: 0o700 });
    const sentinel = path.join(target, 'sentinel');
    fs.writeFileSync(sentinel, 'unchanged');
    if (kind === 'ancestor') fs.symlinkSync(target, path.dirname(state));
    else {
      fs.mkdirSync(path.dirname(state), { mode: 0o700 });
      if (kind === 'profile') fs.symlinkSync(target, profile);
      else fs.symlinkSync(sentinel, state);
    }
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink|symbolic/i);
    assert.equal(result.observed.launches.length, 0);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'unchanged');
  }));
}

test('demo sessions: reject foreign-owned custom session directory', { skip }, () => fixture(({ state, run }) => {
  fs.mkdirSync(path.dirname(state), { mode: 0o700 });
  const result = run({ SESSION_FOREIGN_PATH: path.dirname(state) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner|owned/i);
  assert.equal(result.observed.launches.length, 0);
}));

test('demo sessions: failed persistence preserves prior state, removes temporary files, closes browser', { skip }, () => fixture(({ state, run }) => {
  fs.mkdirSync(path.dirname(state), { mode: 0o700 });
  fs.writeFileSync(state, '{"old":true}', { mode: 0o600 });
  const result = run({ SESSION_FAIL_WRITE: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /synthetic persistence failure/);
  assert.equal(fs.readFileSync(state, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(path.dirname(state)).sort(), ['auth-state.json', 'chrome-profile']);
  assert.equal(result.observed.closed, true);
}));

for (const umask of ['0177', '0777']) {
  test(`demo sessions: normalize only fresh directories and file under umask ${umask}`, { skip }, () => fixture(({ root, profile, state, run }) => {
    const result = run({ SESSION_UMASK: umask });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.statSync(profile).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.dirname(state)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(state).mode & 0o777, 0o600);
    assert.ok(result.observed.writes.every(write => write.mode === 0o600));
    assert.equal(fs.statSync(root).mode & 0o777, 0o755, 'existing shared ancestor must not be chmodded');
  }));
}

test('demo sessions: reject a nonsticky writable ancestor without chmod', { skip }, () => fixture(({ root, run }) => {
  const shared = path.join(root, 'shared');
  fs.mkdirSync(shared, { mode: 0o777 });
  fs.chmodSync(shared, 0o777);
  const result = run({}, { state: path.join(shared, 'private', 'auth-state.json'), profile: path.join(shared, 'private', 'profile') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ancestor|writ|sticky/i);
  assert.equal(result.observed.launches.length, 0);
  assert.equal(fs.statSync(shared).mode & 0o777, 0o777);
}));

test('demo sessions: reject a foreign-owned ancestor even without write bits', { skip }, () => fixture(({ root, run }) => {
  const result = run({ SESSION_FOREIGN_PATH: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner|owned/i);
  assert.equal(result.observed.launches.length, 0);
}));

test('demo sessions: allow a trusted sticky writable ancestor', { skip }, () => fixture(({ root, run }) => {
  const shared = path.join(root, 'sticky');
  fs.mkdirSync(shared, { mode: 0o777 });
  fs.chmodSync(shared, 0o1777);
  const result = run({}, { state: path.join(shared, 'private', 'auth-state.json'), profile: path.join(shared, 'private', 'profile') });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.statSync(shared).mode & 0o7777, 0o1777);
}));

test('demo sessions: existing state requires exactly 0600 before browser launch', { skip }, () => fixture(({ state, run }) => {
  fs.mkdirSync(path.dirname(state), { mode: 0o700 });
  fs.writeFileSync(state, '{"old":true}', { mode: 0o644 });
  fs.chmodSync(state, 0o644);
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /0600|600/);
  assert.equal(result.observed.launches.length, 0);
  assert.equal(fs.statSync(state).mode & 0o777, 0o644, 'existing file must not be silently chmodded');
}));

for (const closeFails of [false, true]) {
  test(`demo sessions: closed window exits 2 promptly${closeFails ? ' despite close failure' : ''}`, { skip }, () => fixture(({ run }) => {
    const result = run({ SESSION_CLOSED: '1', ...(closeFails ? { SESSION_FAIL_CLOSE: '1' } : {}) });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /window was closed/);
    assert.doesNotMatch(result.stdout, /timed out|SUCCESS/);
    assert.equal(result.observed.closed, true);
    if (closeFails) assert.match(result.stderr, /synthetic browser close failure/);
  }));
}

test('demo sessions: unexpected locator error remains visible alongside close failure', { skip }, () => fixture(({ run }) => {
  const result = run({ SESSION_FAIL_LOCATOR: '1', SESSION_FAIL_CLOSE: '1' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /synthetic locator failure/);
  assert.match(result.stderr, /synthetic browser close failure/);
  assert.doesNotMatch(result.stdout, /timed out|SUCCESS/);
}));

test('demo sessions: timeout retains exit 1 and reports browser close failure', { skip }, () => fixture(({ run }) => {
  const result = run({ SESSION_FAIL_CLOSE: '1' }, { timeoutMin: '0' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /timed out/);
  assert.match(result.stderr, /synthetic browser close failure/);
  assert.doesNotMatch(result.stdout, /SUCCESS/);
}));

test('demo sessions: write failure remains visible alongside failed browser close', { skip }, () => fixture(({ run }) => {
  const result = run({ SESSION_FAIL_WRITE: '1', SESSION_FAIL_CLOSE: '1' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /synthetic persistence failure/);
  assert.match(result.stderr, /synthetic browser close failure/);
}));

test('demo sessions: successful persistence plus failed browser close fails without success message', { skip }, () => fixture(({ state, run }) => {
  const result = run({ SESSION_FAIL_CLOSE: '1' });
  assert.equal(result.status, 3);
  assert.ok(fs.existsSync(state));
  assert.match(result.stderr, /synthetic browser close failure/);
  assert.doesNotMatch(result.stdout, /SUCCESS/);
}));

test('demo sessions: write and cleanup failures are both reported, prior state retained', { skip }, () => fixture(({ state, run }) => {
  fs.mkdirSync(path.dirname(state), { mode: 0o700 });
  fs.writeFileSync(state, '{"old":true}', { mode: 0o600 });
  const result = run({ SESSION_FAIL_WRITE: '1', SESSION_FAIL_CLEANUP: '1' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /synthetic persistence failure/);
  assert.match(result.stderr, /synthetic cleanup failure/);
  assert.equal(fs.readFileSync(state, 'utf8'), '{"old":true}');
  assert.equal(result.observed.closed, true);
}));

test('demo sessions: a successful rename does not attempt redundant temporary cleanup', { skip }, () => fixture(({ run }) => {
  const result = run({ SESSION_FAIL_CLEANUP: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.observed.removals, []);
}));
