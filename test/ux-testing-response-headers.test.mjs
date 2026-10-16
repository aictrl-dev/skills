import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const serverScript = fileURLToPath(new URL('../skills/ux-testing/scripts/server.cjs', import.meta.url));
const markup = '<!doctype html><script>globalThis.synthetic_header_probe = true</script>';
const verifyToken = 'synthetic-header-test-verifier-000000000000';
const preload = `
const Module = require('node:module');
const original = Module._load;
Module._load = function(name, ...args) {
  if (name !== 'playwright') return original.call(this, name, ...args);
  return { chromium: { async launch() { return { async newContext() {
    const page = {
      on() {}, async goto() {}, async waitForTimeout() {},
      locator() { return { async ariaSnapshot() { return ${JSON.stringify(markup)}; } }; }
    };
    return { setDefaultTimeout() {}, async newPage() { return page; }, on() {}, async close() {} };
  } }; } } };
};
`;

async function ephemeralPort() {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => reservation.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  assert.ok(port !== 3000 && port !== 8080);
  return port;
}

async function startHarness(t) {
  const fixture = mkdtempSync(path.join(tmpdir(), 'ux-response-headers-'));
  const hook = path.join(fixture, 'trusted-playwright-preload.cjs');
  writeFileSync(hook, preload);
  const port = await ephemeralPort();
  const child = spawn(process.execPath, ['--require', hook, serverScript], {
    cwd: fixture, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: '', HOME: fixture, TMPDIR: fixture, TMP: fixture, TEMP: fixture,
      NODE_PATH: '', NODE_OPTIONS: '', UX_PORT: String(port),
      UX_TARGET: 'https://synthetic.invalid', UX_OUT: path.join(fixture, 'output'),
      UX_VERIFY_TOKEN: verifyToken,
    },
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8192); });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      const killer = setTimeout(() => child.kill('SIGKILL'), 1000);
      await stopped;
      clearTimeout(killer);
    }
    rmSync(fixture, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Harness startup timed out: ${stderr}`)), 5000);
    const ready = () => { clearTimeout(timer); resolve(); };
    child.stdout.on('data', chunk => {
      output = (output + chunk).slice(-8192);
      if (output.includes(`ux harness on ${port}`)) ready();
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Harness exited ${code}: ${stderr}`)); });
  });
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  const token = readFileSync(path.join(fixture, `ux-harness-${uid}`, `${port}.token`), 'utf8');
  const request = (body, overrides = {}) => new Promise((resolve, reject) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = {
      'content-type': 'application/json', 'content-length': Buffer.byteLength(text),
      'x-ux-token': token, ...overrides,
    };
    if (headers['x-ux-token'] === null) delete headers['x-ux-token'];
    const req = http.request({
      host: '127.0.0.1', port, method: 'POST', agent: false,
      headers,
    }, res => {
      let response = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { response += chunk; });
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: response }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('HTTP request timed out')));
    req.once('error', reject);
    req.end(text);
  });
  return { port, request };
}

function plain(response, status, body) {
  assert.equal(response.status, status);
  assert.equal(response.body, body, 'response text must remain literal');
  assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
}

test('UX harness HTTP responses declare literal plain text without sniffing', { timeout: 20000 }, async t => {
  const { port, request } = await startHarness(t);
  await t.test('successful snapshots preserve literal HTML', async () => {
    plain(await request({ session: 'headers', action: 'open' }), 200, 'Opened the app. Use "snapshot" to see the page.');
    plain(await request({ session: 'headers', action: 'snapshot' }), 200, markup);
  });
  await t.test('error responses preserve literal HTML and the existing application status', async () => {
    const response = await request({ session: 'error', action: 'open', scenario: markup }, { 'x-ux-verify-token': verifyToken });
    plain(response, 200, `ERROR: scenario "${markup}" given but UX_SCENARIO_SEL is not configured`);
  });
  await t.test('missing and wrong authentication remain 401', async () => {
    for (const value of [null, 'synthetic-wrong-token']) {
      plain(await request({}, { 'x-ux-token': value }), 401,
        'ERROR: missing or wrong harness token (run the client from the same machine as the server)');
    }
  });
  await t.test('Origin, Referer and wrong Host remain forbidden', async () => {
    for (const headers of [{ origin: 'https://synthetic.invalid' }, { referer: 'https://synthetic.invalid' }, { host: 'synthetic.invalid' }]) {
      plain(await request({}, headers), 403, 'ERROR: forbidden');
    }
  });
  await t.test('oversized authenticated request remains 413', async () => {
    plain(await request('x'.repeat(1024 * 1024 + 1)), 413, 'ERROR: request too large');
  });
  await t.test('HTTP parser rejection remains an empty 400 with explicit text headers', async () => {
    const wire = await new Promise((resolve, reject) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      let raw = '';
      socket.setEncoding('utf8');
      socket.setTimeout(5000, () => socket.destroy(new Error('Parser response timed out')));
      socket.once('error', reject);
      socket.on('data', chunk => { raw += chunk; });
      socket.once('end', () => resolve(raw));
      socket.once('connect', () => socket.end('NOT HTTP\r\n\r\n'));
    });
    const [headers, body] = wire.split('\r\n\r\n');
    assert.match(headers, /^HTTP\/1\.1 400 Bad Request/);
    assert.match(headers, /\r\nContent-Type: text\/plain; charset=utf-8/i);
    assert.match(headers, /\r\nX-Content-Type-Options: nosniff/i);
    assert.equal(body, '');
  });
});
