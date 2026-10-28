import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

function narration(t, { key = true, fail = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'demo-credentials-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const events = join(dir, 'events.jsonl');
  writeFileSync(join(dir, 'segments.json'), '[{"slug":"hook","text":"Welcome."}]');
  writeFileSync(join(dir, 'demo.config.json'), '{"voice":{"voiceId":"demo-voice"}}');
  writeFileSync(join(dir, '.env'), 'ELEVENLABS_API_KEY=file-only-secret\n');
  const preload = join(dir, 'http.cjs');
  writeFileSync(preload, `
    const fs = require('fs');
    global.fetch = async (url, init) => {
      fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ url, redirect: init.redirect }) + '\\n');
      return new Response(${fail ? "'reflected-env-only-secret'" : "url.includes('text-to-speech') ? 'audio' : JSON.stringify({ words: [] })"}, { status: ${fail ? 401 : 200} });
    };
  `);
  const result = spawnSync(process.execPath, ['--require', preload,
    join(ROOT, 'skills/recording-product-demo/scripts/tts-oneshot.cjs'),
    '--segments', join(dir, 'segments.json')], {
    cwd: dir, encoding: 'utf8', env: {
      ELEVENLABS_API_KEY: key ? 'env-only-secret' : '',
      ELEVENLABS_ENV_FILE: join(dir, '.env'),
    },
  });
  let calls = [];
  try { calls = readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  return { result, calls };
}

test('narration refuses a key from a dotenv file without an explicitly supplied provider key', (t) => {
  const { result, calls } = narration(t, { key: false });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ELEVENLABS_API_KEY/);
  assert.deepEqual(calls, [], 'no credential read from disk may reach the network');
  assert.doesNotMatch(result.stdout + result.stderr, /file-only-secret/);
});

test('narration sends the provider key only to fixed ElevenLabs endpoints without redirects', (t) => {
  const { result, calls } = narration(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls, [
    { url: 'https://api.elevenlabs.io/v1/text-to-speech/demo-voice?output_format=mp3_44100_128', redirect: 'error' },
    { url: 'https://api.elevenlabs.io/v1/speech-to-text', redirect: 'error' },
  ]);
});

test('narration errors report the status without reflecting response bodies containing credentials', (t) => {
  const { result } = narration(t, { fail: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HTTP 401/);
  assert.doesNotMatch(result.stdout + result.stderr, /env-only-secret/);
});

test('clip verification transcribes each scene start through the bundled script and cleans temporary audio', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'demo-clip-starts-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, 'bin');
  const events = join(dir, 'events.jsonl');
  mkdirSync(bin);
  for (const file of ['00-hook.mp3', '01-tour.mp3', 'narration-full.mp3']) writeFileSync(join(dir, file), file);
  writeFileSync(join(bin, 'ffmpeg'), `#!${process.execPath}\n
    const fs = require('fs');
    fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ args: process.argv.slice(2) }) + '\\n');
    fs.writeFileSync(process.argv.at(-1), 'first four seconds');
  `, { mode: 0o755 });
  const preload = join(dir, 'http.cjs');
  writeFileSync(preload, `global.fetch = async (url, init) => {
    require('fs').appendFileSync(${JSON.stringify(events)}, JSON.stringify({ url, redirect: init.redirect }) + '\\n');
    return new Response('{"text":"Welcome to the demo"}');
  };`);
  const result = spawnSync(process.execPath, ['--require', preload,
    join(ROOT, 'skills/recording-product-demo/scripts/verify-clip-starts.cjs'), '--out', dir], {
    cwd: dir, encoding: 'utf8', env: { PATH: bin, ELEVENLABS_API_KEY: 'env-only-secret' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n').map(JSON.parse), [
    { clip: '00-hook.mp3', text: 'Welcome to the demo' },
    { clip: '01-tour.mp3', text: 'Welcome to the demo' },
  ]);
  const calls = readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 4);
  for (const event of calls.filter((call) => call.args)) {
    assert.equal(event.args[event.args.indexOf('-t') + 1], '4');
    assert.equal(existsSync(event.args.at(-1)), false, 'temporary audio must be removed');
  }
  assert.deepEqual(calls.filter((call) => call.url), [
    { url: 'https://api.elevenlabs.io/v1/speech-to-text', redirect: 'error' },
    { url: 'https://api.elevenlabs.io/v1/speech-to-text', redirect: 'error' },
  ]);
  assert.doesNotMatch(result.stdout + result.stderr, /env-only-secret/);
});
