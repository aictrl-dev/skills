import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

function fixture(t, { language, reply = { text: 'Clip start' }, status = 200 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'clip-start-review-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = join(dir, 'demo/out/voice');
  const bin = join(dir, 'bin');
  const eventsFile = join(dir, 'events.jsonl');
  mkdirSync(out, { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(out, '01-hook.mp3'), 'audio');
  if (language) writeFileSync(join(dir, 'demo/demo.config.json'), JSON.stringify({ voice: { sttLang: language } }));
  writeFileSync(join(bin, 'ffmpeg'), `#!${process.execPath}\n
    const fs = require('fs');
    fs.appendFileSync(${JSON.stringify(eventsFile)}, JSON.stringify({ kind: 'ffmpeg', hasKey: 'ELEVENLABS_API_KEY' in process.env, envKeys: Object.keys(process.env).sort(), head: process.argv.at(-1) }) + '\\n');
    fs.writeFileSync(process.argv.at(-1), 'clip audio');
  `, { mode: 0o755 });
  const preload = join(dir, 'http.cjs');
  writeFileSync(preload, `global.fetch = async (url, init) => {
    require('fs').appendFileSync(${JSON.stringify(eventsFile)}, JSON.stringify({ kind: 'stt', language: init.body.get('language_code'), hasKey: init.headers['xi-api-key'] === 'private-test-value' }) + '\\n');
    return new Response(${JSON.stringify(JSON.stringify(reply))}, { status: ${status} });
  };`);
  return {
    dir, out, bin,
    run: (args = ['--out', out], env = {}) => spawnSync(process.execPath, ['--require', preload,
      join(ROOT, 'skills/recording-product-demo/scripts/verify-clip-starts.cjs'), ...args], {
      cwd: dir, encoding: 'utf8', env: { PATH: bin, ELEVENLABS_API_KEY: 'private-test-value', ...env },
    }),
    events: () => existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').trim().split('\n').map(JSON.parse) : [],
  };
}

for (const [args, message] of [
  [['--out'], /--out requires a voice directory/],
  [['--out', '--verbose'], /--out requires a voice directory/],
  [['--config'], /--config requires a config file/],
  [['--config', '--verbose'], /--config requires a config file/],
]) {
  test(`clip verifier rejects a missing option value: ${args.join(' ')}`, (t) => {
    const f = fixture(t);
    const result = f.run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /scandir/);
    assert.deepEqual(f.events(), []);
  });
}

test('clip verifier removes the ElevenLabs API key from the ffmpeg environment', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.events().find((event) => event.kind === 'ffmpeg').hasKey, false);
});

test('clip verifier gives ffmpeg only platform environment variables and retains its own API credential', (t) => {
  const f = fixture(t);
  const result = f.run(undefined, {
    HOME: f.dir, TMPDIR: f.dir, LANG: 'C',
    YT_CLIENT_ID: 'test-client-id', YT_CLIENT_SECRET: 'test-client-secret', YT_REFRESH_TOKEN: 'test-refresh-token',
    TYPESAFE_API_KEY: 'test-typesafe-key', UX_SIM_API_KEY: 'test-sim-key',
    OPENAI_API_KEY: 'test-other-key', UNRELATED_PRIVATE_VALUE: 'test-private-value',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.events().find((event) => event.kind === 'ffmpeg').envKeys, ['HOME', 'LANG', 'PATH', 'TMPDIR']);
  assert.equal(f.events().find((event) => event.kind === 'stt').hasKey, true);
});

test('clip verifier uses voice.sttLang from the demo config beside standard output', (t) => {
  const f = fixture(t, { language: 'de' });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.events().find((event) => event.kind === 'stt').language, 'de');
});

test('clip verifier defaults to English when neither config nor environment selects a language', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.events().find((event) => event.kind === 'stt').language, 'en');
});

test('clip verifier accepts an explicit config and lets the environment override its language', (t) => {
  const f = fixture(t);
  const config = join(f.dir, 'custom.config.json');
  writeFileSync(config, '{"voice":{"sttLang":"fr"}}');
  const args = ['--out', f.out, '--config', config];
  assert.equal(f.run(args).status, 0);
  assert.equal(f.events().at(-1).language, 'fr');
  assert.equal(f.run(args, { ELEVENLABS_STT_LANG: 'es' }).status, 0);
  assert.equal(f.events().at(-1).language, 'es');
});

test('clip verifier names the failing clip, hides response bodies, and cleans temporary audio', (t) => {
  const f = fixture(t, { status: 503, reply: { error: 'private-test-value' } });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /01-hook\.mp3.*STT HTTP 503/);
  assert.doesNotMatch(result.stdout + result.stderr, /private-test-value/);
  assert.equal(existsSync(f.events().find((event) => event.kind === 'ffmpeg').head), false);
});

for (const reply of [{}, { text: null }, { text: 42 }, null]) {
  test(`clip verifier fails when a successful STT response has no string text: ${JSON.stringify(reply)}`, (t) => {
    const f = fixture(t, { reply });
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /01-hook\.mp3.*STT response.*text/);
    assert.equal(result.stdout, '');
    assert.equal(existsSync(f.events().find((event) => event.kind === 'ffmpeg').head), false);
  });
}

test('narration splitter passes the selected custom config to its verification command', (t) => {
  const f = fixture(t);
  const segments = join(f.dir, 'demo/segments.json');
  const config = join(f.dir, 'custom.config.json');
  writeFileSync(segments, '[{"slug":"hook","text":"Hello"}]');
  writeFileSync(config, '{"voice":{"sttLang":"de"}}');
  writeFileSync(join(f.out, 'narration-full.stt.json'), '{"words":[{"text":"Hello","type":"word","start":0,"end":1}]}');
  writeFileSync(join(f.bin, 'ffprobe'), `#!${process.execPath}\nprocess.stdout.write('1.5\\n');`, { mode: 0o755 });
  const result = spawnSync('python3', [join(ROOT, 'skills/recording-product-demo/scripts/split-narration.py'),
    '--segments', segments, '--out', f.out, '--config', config], {
    cwd: f.dir, encoding: 'utf8', env: { PATH: f.bin + delimiter + (process.env.PATH || '/usr/bin:/bin') },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.split('\n').some((line) => line.includes('verify-clip-starts.cjs') && line.endsWith(`--config ${config}`)));
});
