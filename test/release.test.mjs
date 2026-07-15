import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT, readJson } from '../scripts/public-catalog.mjs';
import { inspectReleasePublication } from '../scripts/verify-release-publication.mjs';

const metadata = readJson('package.json');

test('release tag must exactly match the shared package version', () => {
  const valid = spawnSync(process.execPath, [
    join(ROOT, 'scripts/resolve-release-target.mjs'), `v${metadata.version}`,
  ], { encoding: 'utf8' });
  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /^package_spec=\.\ndist_tag=beta\n$/);

  const invalid = spawnSync(process.execPath, [
    join(ROOT, 'scripts/resolve-release-target.mjs'), 'v0.0.0',
  ], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /does not match/);
});

test('publication check reports an absent version without packing', async () => {
  let packed = false;
  const result = await inspectReleasePublication('.', {
    fetchImpl: async () => ({ status: 404, ok: false }),
    pack: async () => {
      packed = true;
      return {};
    },
  });

  assert.deepEqual(result, { published: false, name: metadata.name, version: metadata.version });
  assert.equal(packed, false);
});

test('publication check accepts only matching registry integrity', async () => {
  const matching = await inspectReleasePublication('.', {
    fetchImpl: async () => ({
      status: 200,
      ok: true,
      json: async () => ({ dist: { integrity: 'sha512-match' } }),
    }),
    pack: async () => ({ ...metadata, integrity: 'sha512-match' }),
  });
  assert.deepEqual(matching, { published: true, name: metadata.name, version: metadata.version });

  await assert.rejects(() => inspectReleasePublication('.', {
    fetchImpl: async () => ({
      status: 200,
      ok: true,
      json: async () => ({ dist: { integrity: 'sha512-registry' } }),
    }),
    pack: async () => ({ ...metadata, integrity: 'sha512-local' }),
  }), /does not match the local release package/);
});

test('publication target cannot escape the repository', async () => {
  await assert.rejects(
    () => inspectReleasePublication('..', { fetchImpl: async () => ({ status: 404 }) }),
    /must stay inside the repository/,
  );
});
