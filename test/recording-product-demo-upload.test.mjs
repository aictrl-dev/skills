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

function fixture(t, upload, { failCloud = false, failHttp = false, credentials = true, unavailableCloud = false, emptyEvents = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'publish-upload-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const build = join(cwd, 'demo');
  const bin = join(cwd, 'bin');
  const eventsFile = join(cwd, 'events.jsonl');
  if (emptyEvents) writeFileSync(eventsFile, '');
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
  const events = () => existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
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
  { type: 's3', path: 's3://192.168.1.1/demos' }, { type: 'gcs', path: 'gs://192.168.1.1/demos' },
  { type: 's3', path: 's3://xn--invalid/demos' }, { type: 's3', path: 's3://sthree-invalid/demos' },
  { type: 's3', path: 's3://amzn-s3-demo-invalid/demos' }, { type: 'gcs', path: 'gs://goog-demo/demos' },
  { type: 'gcs', path: 'gs://my-google-demo/demos' }, { type: 'gcs', path: 'gs://my-g00gle-demo/demos' },
  { type: 'gcs', path: 'gs://Bucket/demos' }, { type: 's3', path: 's3://Bucket/demos' },
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

for (const config of [
  { type: 'gcs', path: 'gs://demo-bucket/デモ/café/🎬' },
  { type: 's3', path: 's3://demo-accesspoint-45ee794a89a74c61a0b56b317be53c6f-s3alias/デモ/🎬' },
  { type: 'gcs', path: 'gs://999.12.34.56/demos' },
  { type: 's3', path: 's3://999.12.34.56/demos' },
]) {
  test(`publish: local checks preserve literal supported destination ${config.path}`, (t) => {
    const f = fixture(t, config);
    const result = f.run('--upload');
    assert.equal(result.status, 0, result.stderr);
    const command = f.events().find((event) => event.type === (config.type === 'gcs' ? 'gcloud' : 'aws'));
    assert.ok(command.args.includes(config.path));
  });
}

for (const type of ['gcs', 's3']) {
  test(`publish: ${type} destination logs escape controls while argv preserves Unicode and literal bytes`, (t) => {
    const destination = `${type === 'gcs' ? 'gs' : 's3'}://demo-bucket/デモ/\u001b[31m\t\u007f\u0085\u202e🎬\u{e0001}`;
    const f = fixture(t, { type, path: destination });
    const result = f.run('--upload');
    assert.equal(result.status, 0, result.stderr);
    const command = f.events().find((event) => event.type === (type === 'gcs' ? 'gcloud' : 'aws'));
    assert.ok(command.args.includes(destination));
    for (const prefix of [`[pub] uploading to ${type}: `, '[pub] uploaded to ']) {
      const line = result.stdout.split('\n').find((entry) => entry.startsWith(prefix));
      assert.ok(line);
      assert.doesNotMatch(line, /[\u0000-\u001f\u007f-\u009f\p{Cf}]/u);
      assert.equal(JSON.parse(line.slice(prefix.length)), destination);
    }
  });
}

test('publish: rejected configuration leaves a pre-existing empty event log empty', (t) => {
  const f = fixture(t, { type: 'other' }, { emptyEvents: true });
  assert.equal(f.run('--upload').status, 1);
  assert.deepEqual(f.events(), []);
});

test('publish: shipped example config keeps upload disabled', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'skills/recording-product-demo/templates/demo.config.example.json'), 'utf8'));
  assert.equal(config.publish.upload, null);
});
