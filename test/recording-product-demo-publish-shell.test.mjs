import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const publish = join(ROOT, 'skills/recording-product-demo/scripts/publish.cjs');

function fixture(t, { buildName = 'demo', destination = 'gs://test-bucket/demos', uploadType = 'gcs', failUpload = false, unavailableCloud = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'publish-shell-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const build = join(cwd, buildName);
  const bin = join(cwd, 'bin');
  const cloudLog = join(cwd, 'cloud.jsonl');
  const uploaded = join(cwd, 'uploaded');
  mkdirSync(bin);
  mkdirSync(uploaded);
  mkdirSync(join(build, 'out/voice'), { recursive: true });
  writeFileSync(join(build, 'out/final.mp4'), 'final video');
  writeFileSync(join(build, 'out/main.mp4'), 'main video');
  writeFileSync(join(build, 'out/voice/narration-full.stt.json'), JSON.stringify({
    words: [{ type: 'word', text: 'Demo', start: 0, end: 1 }],
  }));
  writeFileSync(join(build, 'demo.config.json'), JSON.stringify({ publish: { upload: { type: uploadType, path: destination } } }));
  const stub = (name, body) => writeFileSync(join(bin, name), `#!${process.execPath}\n${body}`, { mode: 0o755 });
  stub('ffmpeg', `require('fs').writeFileSync(process.argv.at(-1), 'generated media');`);
  stub('ffprobe', `console.log(process.argv.at(-1).endsWith('main.mp4') ? '5' : '8');`);
  // Keep the harmless injection probe available without exposing ambient tools.
  stub('touch', `for (const file of process.argv.slice(2)) require('fs').writeFileSync(file, 'marker');`);
  const cloudStub = `
    const fs = require('fs');
    const path = require('path');
    const args = process.argv.slice(2);
    fs.appendFileSync(process.env.CLOUD_LOG, JSON.stringify(args) + '\\n');
    if (process.env.FAIL_UPLOAD === '1') {
      console.error('stub upload denied');
      process.exit(23);
    }
    // Model cp's multi-source destination layout; every source must name a real entry.
    for (const source of args.slice(3, -1)) {
      fs.cpSync(source, path.join(process.env.UPLOADED, path.basename(source)), { recursive: true });
    }
  `;
  stub('gcloud', cloudStub);
  stub('aws', cloudStub);
  if (unavailableCloud) writeFileSync(join(bin, 'gcloud'), '#!/nonexistent-publish-test-interpreter\n', { mode: 0o755 });
  const run = (...args) => spawnSync(process.execPath, [publish, '--build', build, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: bin, CLOUD_LOG: cloudLog, UPLOADED: uploaded, FAIL_UPLOAD: failUpload ? '1' : '0' },
  });
  const calls = () => existsSync(cloudLog) ? readFileSync(cloudLog, 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { cwd, build, destination, uploaded, run, calls };
}

function assertLiteralUpload(f, result) {
  assert.equal(result.status, 0, result.stderr);
  const sources = readdirSync(join(f.build, 'out/publish')).filter((name) => !name.startsWith('.')).sort();
  assert.deepEqual(f.calls(), [[
    'storage', 'cp', '-r',
    ...sources.map((name) => join(f.build, 'out/publish', name)),
    f.destination,
  ]]);
  assert.deepEqual(readdirSync(f.uploaded).sort(), sources);
  assert.equal(existsSync(join(f.uploaded, 'publish')), false, 'publish directory must not wrap uploaded assets');
}

test('publish: GCS receives explicit sources and preserves kit layout with build path spaces', (t) => {
  const f = fixture(t, { buildName: 'product demo with spaces' });
  mkdirSync(join(f.build, 'out/publish/extra-assets'), { recursive: true });
  writeFileSync(join(f.build, 'out/publish/extra-assets/logo.svg'), '<svg/>');
  writeFileSync(join(f.build, 'out/publish/.private'), 'not part of the existing upload glob');
  assertLiteralUpload(f, f.run());
  assert.equal(readFileSync(join(f.uploaded, 'extra-assets/logo.svg'), 'utf8'), '<svg/>');
  assert.match(readFileSync(join(f.uploaded, 'captions.srt'), 'utf8'), /Demo/);
});

test('publish: shell syntax in GCS destination stays literal', (t) => {
  const f = fixture(t, { destination: 'gs://test-bucket/demo; touch DESTINATION_MARKER' });
  const result = f.run();
  assert.equal(existsSync(join(f.cwd, 'DESTINATION_MARKER')), false, 'destination must never execute a shell command');
  assertLiteralUpload(f, result);
});

test('publish: shell syntax in build directory stays literal', (t) => {
  const f = fixture(t, { buildName: 'demo; touch BUILD_MARKER; #' });
  const result = f.run();
  assert.equal(existsSync(join(f.cwd, 'BUILD_MARKER')), false, 'build path must never execute a shell command');
  assertLiteralUpload(f, result);
});

test('publish: --skip-upload builds the kit without invoking a cloud executable', (t) => {
  const f = fixture(t, { destination: 'gs://test-bucket/demo; touch SKIP_MARKER' });
  const result = f.run('--skip-upload');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.calls(), []);
  assert.equal(existsSync(join(f.cwd, 'SKIP_MARKER')), false);
  assert.equal(existsSync(join(f.build, 'out/publish/demo.mp4')), true);
  assert.match(result.stdout, /upload skipped/);
});

test('publish: GCS failure reports stderr and exits nonzero', (t) => {
  const f = fixture(t, { failUpload: true });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(f.calls().length, 1);
  assert.match(result.stderr, /gcloud failed:[\s\S]*stub upload denied/);
  assert.doesNotMatch(result.stdout, /uploaded to/);
});

test('publish: unavailable GCS executable reports spawn failure without null-stderr TypeError', (t) => {
  const f = fixture(t, { unavailableCloud: true });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /gcloud failed:[\s\S]*ENOENT/);
  assert.doesNotMatch(result.stderr, /TypeError|Cannot read/);
  assert.deepEqual(f.calls(), []);
});

for (const [uploadType, destination] of [
  ['gcs', '--log-http'], ['s3', '--endpoint-url=https://example.invalid'],
  ['gcs', 'gs:///prefix'], ['s3', 's3:///prefix'],
]) {
  test(`publish: rejects ${uploadType} option-like or bucketless destination ${destination} before processing`, (t) => {
    const f = fixture(t, { uploadType, destination });
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /upload.*destination/i);
    assert.deepEqual(f.calls(), []);
    assert.equal(existsSync(join(f.build, 'out/publish')), false);
  });
}

test('publish: --skip-upload keeps invalid upload destinations local', (t) => {
  const f = fixture(t, { destination: '--log-http' });
  const result = f.run('--skip-upload');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.calls(), []);
  assert.equal(existsSync(join(f.build, 'out/publish/demo.mp4')), true);
});
