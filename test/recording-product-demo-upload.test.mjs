import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const publish = join(ROOT, 'skills/recording-product-demo/scripts/publish.cjs');
const configurations = [
  { type: 'gcs', path: 'gs://demo-bucket/prefix' },
  { type: 's3', path: 's3://demo-bucket/prefix' },
  { type: 'youtube' },
];

function fixture(t, upload, { failCloud = false, failHttp = false, credentials = true, unavailableCloud = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'publish-upload-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const build = join(cwd, 'demo');
  const bin = join(cwd, 'bin');
  const eventsFile = join(cwd, 'events.jsonl');
  mkdirSync(bin);
  mkdirSync(join(build, 'out'), { recursive: true });
  writeFileSync(join(build, 'out/final.mp4'), 'video');
  writeFileSync(join(build, 'demo.config.json'), JSON.stringify({ publish: { upload } }));
  const stub = (name, body) => writeFileSync(join(bin, name), `#!${process.execPath}\n${body}`, { mode: 0o755 });
  const log = `require('fs').appendFileSync(process.env.EVENTS, JSON.stringify({ type: require('path').basename(process.argv[1]), args: process.argv.slice(2) }) + '\\n');`;
  stub('ffmpeg', `${log}\nrequire('fs').writeFileSync(process.argv.at(-1), 'generated video');`);
  for (const name of ['gcloud', 'aws']) stub(name, `${log}\nif (process.env.FAIL_CLOUD === '1') { console.error('cloud denied'); process.exit(23); }`);
  if (unavailableCloud) writeFileSync(join(bin, 'gcloud'), '#!/nonexistent-publish-test-interpreter\n', { mode: 0o755 });
  const preload = join(cwd, 'mock-http.cjs');
  writeFileSync(preload, `
    const originalLog = console.log;
    console.log = (...args) => {
      if (String(args[0]).startsWith('[pub] uploading')) require('fs').appendFileSync(process.env.EVENTS, JSON.stringify({ type: 'announcement' }) + '\\n');
      originalLog(...args);
    };
    global.fetch = async (url, options) => {
      const event = { type: 'http', url, method: options.method };
      if (url.includes('uploadType=resumable')) event.metadata = JSON.parse(options.body);
      require('fs').appendFileSync(process.env.EVENTS, JSON.stringify(event) + '\\n');
      if (process.env.FAIL_HTTP === '1') return { ok: false, status: 503, text: async () => 'upload unavailable' };
      return { ok: true, json: async () => url.includes('oauth2') ? { access_token: 'test-access-secret' } : { id: 'video-id' }, headers: { get: () => 'https://mock-upload.invalid/session' } };
    };
  `);
  const run = (...args) => spawnSync(process.execPath, ['--require', preload, publish, '--build', build, ...args], {
    cwd, encoding: 'utf8',
    env: {
      PATH: bin, EVENTS: eventsFile,
      FAIL_CLOUD: failCloud ? '1' : '0', FAIL_HTTP: failHttp ? '1' : '0',
      YT_CLIENT_ID: credentials ? 'test-client-secret' : '',
      YT_CLIENT_SECRET: credentials ? 'test-oauth-secret' : '',
      YT_REFRESH_TOKEN: credentials ? 'test-refresh-secret' : '',
    },
  });
  const events = () => existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { build, run, events };
}

function assertPrivateOutput(result) {
  assert.doesNotMatch(result.stdout + result.stderr, /test-(?:client|oauth|refresh|access)-secret/);
}

for (const config of configurations) {
  test(`publish: configured ${config.type} remains local by default and with --skip-upload`, (t) => {
    for (const args of [[], ['--skip-upload']]) {
      const f = fixture(t, config);
      const result = f.run(...args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(f.events().filter((event) => event.type !== 'ffmpeg').length, 0);
      assert.equal(existsSync(join(f.build, 'out/publish/demo.mp4')), true);
      assertPrivateOutput(result);
    }
  });
}

for (const config of configurations.slice(0, 2)) {
  test(`publish: --upload invokes ${config.type} with configured destination`, (t) => {
    const f = fixture(t, config);
    const result = f.run('--upload');
    assert.equal(result.status, 0, result.stderr);
    const events = f.events();
    const upload = events.find((event) => event.type === (config.type === 'gcs' ? 'gcloud' : 'aws'));
    assert.ok(upload);
    assert.ok(upload.args.includes(config.path));
    assert.ok(events.findIndex((event) => event.type === 'announcement') < events.indexOf(upload));
    assert.match(result.stdout, new RegExp(`uploading.*${config.type}.*${config.path}`));
    assert.equal(events.some((event) => event.type === 'http'), false);
    assertPrivateOutput(result);
  });
}

test('publish: invalid configured destination stays local without --upload', (t) => {
  const f = fixture(t, { type: 'gcs', path: '--log-http' });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.events().filter((event) => event.type !== 'ffmpeg').length, 0);
  assert.equal(existsSync(join(f.build, 'out/publish/demo.mp4')), true);
});

for (const privacy of [undefined, 'unlisted', 'private', 'public']) {
  test(`publish: explicit YouTube upload uses ${privacy ?? 'default unlisted'} visibility`, (t) => {
    const f = fixture(t, { type: 'youtube', privacy, title: 'Demo title', description: 'Demo description' });
    const result = f.run('--upload');
    assert.equal(result.status, 0, result.stderr);
    const calls = f.events().filter((event) => event.type === 'http');
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
    assert.deepEqual(calls[1].metadata, {
      snippet: { title: 'Demo title', description: 'Demo description' },
      status: { privacyStatus: privacy ?? 'unlisted' },
    });
    assert.equal(calls[2].method, 'PUT');
    assert.ok(f.events().findIndex((event) => event.type === 'announcement') < f.events().findIndex((event) => event.type === 'http'));
    assert.match(result.stdout, new RegExp(`uploading.*YouTube.*${privacy ?? 'unlisted'}`));
    assertPrivateOutput(result);
  });
}

const invalidConfigurations = [
  undefined, null, 'gcs', [], {}, { type: 'other' },
  { type: 'gcs' }, { type: 'gcs', path: 's3://demo-bucket/path' },
  { type: 'gcs', path: 'gs:///path' }, { type: 'gcs', path: 'gs://bad bucket/path' },
  { type: 's3', path: 'gs://demo-bucket/path' }, { type: 's3', path: 's3:///path' },
  { type: 'youtube', privacy: 'friends' }, { type: 'youtube', privacy: 7 },
  { type: 'youtube', title: {} }, { type: 'youtube', description: 3 },
];
for (const config of invalidConfigurations) {
  test(`publish: --upload rejects invalid config ${JSON.stringify(config)} before processing`, (t) => {
    const f = fixture(t, config);
    const result = f.run('--upload');
    assert.equal(result.status, 1);
    assert.deepEqual(f.events(), [], 'no media, cloud commands or HTTP before validation');
    assert.equal(existsSync(join(f.build, 'out/publish')), false);
    assert.match(result.stderr, /upload/i);
    assertPrivateOutput(result);
  });
}

test('publish: contradictory flags fail before media or network', (t) => {
  const f = fixture(t, configurations[0]);
  const result = f.run('--upload', '--skip-upload');
  assert.equal(result.status, 1);
  assert.deepEqual(f.events(), []);
  assert.match(result.stderr, /--upload.*--skip-upload/);
});

for (const config of configurations) {
  test(`publish: explicit ${config.type} failure exits nonzero`, (t) => {
    const f = fixture(t, config, { failCloud: true, failHttp: true });
    const result = f.run('--upload');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cloud denied|HTTP 503/);
    assertPrivateOutput(result);
  });
}

test('publish: missing YouTube credentials fail without HTTP or credential output', (t) => {
  const f = fixture(t, { type: 'youtube' }, { credentials: false });
  const result = f.run('--upload');
  assert.equal(result.status, 1);
  assert.equal(f.events().some((event) => event.type === 'http'), false);
  assert.match(result.stderr, /needs YT_CLIENT_ID/);
  assertPrivateOutput(result);
});

test('publish: unavailable cloud CLI reports an actionable spawn error', (t) => {
  const f = fixture(t, configurations[0], { unavailableCloud: true });
  const result = f.run('--upload');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /gcloud failed:[\s\S]*ENOENT/);
  assert.doesNotMatch(result.stderr, /TypeError|Cannot read/);
  assertPrivateOutput(result);
});
