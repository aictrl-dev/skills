import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

function simulate(config) {
  return spawnSync(process.execPath, ['-e', `
    const { simBackend } = require(${JSON.stringify(join(ROOT, 'skills/ux-testing/scripts/common.cjs'))});
    global.fetch = async (url, init) => {
      console.log(JSON.stringify({ url, redirect: init.redirect, authorization: init.headers.Authorization }));
      return new Response('{"answers":{}}');
    };
    const backend = simBackend(${JSON.stringify(config)});
    if (backend.error) { console.error(backend.error); process.exit(2); }
    backend.ask({}, {}).catch(() => process.exit(1));
  `], { env: {}, encoding: 'utf8' });
}

test('simulator keeps TypeSafe credentials on its own endpoint and disables redirects', () => {
  const result = simulate({ TYPESAFE_API_KEY: 'provider-test-value' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    url: 'https://api.typesafe.ai/v1/systemone', redirect: 'manual', authorization: 'Bearer provider-test-value',
  });
});

test('custom simulator never reuses the TypeSafe key for another host', () => {
  const result = simulate({ TYPESAFE_API_KEY: 'provider-test-value', UX_SIM_ENDPOINT: 'https://example.test/simulate', UX_SIM_MODEL: 'model' });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stderr, /provider-test-value/);
});

test('custom simulator sends only the separately supplied endpoint key without redirects', () => {
  const result = simulate({ TYPESAFE_API_KEY: 'provider-test-value', UX_SIM_ENDPOINT: 'https://example.test/simulate', UX_SIM_API_KEY: 'custom-test-value', UX_SIM_MODEL: 'model' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    url: 'https://example.test/simulate', redirect: 'manual', authorization: 'Bearer custom-test-value',
  });
});

async function localSimulator(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const endpoint = `http://127.0.0.1:${server.address().port}/simulate`;
  return () => promisify(execFile)(process.execPath, ['-e', `
    const { simBackend } = require(${JSON.stringify(join(ROOT, 'skills/ux-testing/scripts/common.cjs'))});
    simBackend(${JSON.stringify({ UX_SIM_ENDPOINT: endpoint, UX_SIM_API_KEY: 'local-test-value', UX_SIM_MODEL: 'model' })}).ask({}, {}).catch((e) => { console.error(e.message); process.exitCode = 1; });
  `], { timeout: 15000, env: {} });
}

test('simulator rejects redirects after one request with an actionable error and no forwarding', async (t) => {
  let attempts = 0; let forwarded = 0;
  const run = await localSimulator(t, (req, res) => {
    if (req.url === '/simulate') {
      attempts++;
      res.writeHead(307, { Location: '/destination?token=private-location-value' }).end();
    } else {
      forwarded++;
      res.end('{"answers":{}}');
    }
  });
  await assert.rejects(run(), (error) => {
    assert.match(error.stderr, /HTTP 307.*redirect.*final URL/i);
    assert.doesNotMatch(error.stderr, /local-test-value|private-location-value/);
    return true;
  });
  assert.equal(attempts, 1);
  assert.equal(forwarded, 0);
});

test('simulator still retries a real connection failure and succeeds after recovery', async (t) => {
  let attempts = 0;
  const run = await localSimulator(t, (req, res) => {
    attempts++;
    if (attempts === 1) req.socket.destroy();
    else res.end('{"answers":{}}');
  });
  await run();
  assert.equal(attempts, 2);
});
