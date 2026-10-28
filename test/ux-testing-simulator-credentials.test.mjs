import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

function simulate(env) {
  return spawnSync(process.execPath, ['-e', `
    const { simBackend } = require(${JSON.stringify(join(ROOT, 'skills/ux-testing/scripts/common.cjs'))});
    global.fetch = async (url, init) => {
      console.log(JSON.stringify({ url, redirect: init.redirect, authorization: init.headers.Authorization }));
      return new Response('{"answers":{}}');
    };
    const backend = simBackend();
    if (backend.error) { console.error(backend.error); process.exit(2); }
    backend.ask({}, {}).catch(() => process.exit(1));
  `], { env, encoding: 'utf8' });
}

test('simulator keeps TypeSafe credentials on its own endpoint and disables redirects', () => {
  const result = simulate({ TYPESAFE_API_KEY: 'provider-test-value' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    url: 'https://api.typesafe.ai/v1/systemone', redirect: 'error', authorization: 'Bearer provider-test-value',
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
    url: 'https://example.test/simulate', redirect: 'error', authorization: 'Bearer custom-test-value',
  });
});
