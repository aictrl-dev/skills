import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

const splitter = join(ROOT, 'skills/recording-product-demo/scripts/split-narration.py');
const fixtures = join(ROOT, 'evals/fixtures/recording-product-demo');

function fixture(t, { segments, transcript, duration = 7.5, probeStatus = 0, probeError = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'imported-narration-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = join(dir, "voice files' (en)");
  const bin = join(dir, 'bin');
  const events = join(dir, 'media.jsonl');
  const segmentPath = join(dir, 'segments.json');
  mkdirSync(out);
  mkdirSync(bin);
  writeFileSync(segmentPath, JSON.stringify(segments ?? JSON.parse(readFileSync(join(fixtures, 'segments.json'), 'utf8'))));
  writeFileSync(join(out, 'narration-full.stt.json'), JSON.stringify(transcript ?? JSON.parse(readFileSync(join(fixtures, 'narration-full.stt.json'), 'utf8'))));
  writeFileSync(join(out, 'narration-full.mp3'), 'prepared audio');
  for (const name of ['ffmpeg', 'ffprobe']) {
    writeFileSync(join(bin, name), `#!${process.execPath}\n
      const fs = require('fs');
      fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ name: ${JSON.stringify(name)}, args: process.argv.slice(2) }) + '\\n');
      ${name === 'ffprobe' ? `process.stdout.write(${JSON.stringify(String(duration))}); process.stderr.write(${JSON.stringify(probeError)}); process.exit(${probeStatus});` : "fs.writeFileSync(process.argv.at(-1), 'scene audio');"}
    `, { mode: 0o755 });
  }
  return {
    dir, out, segmentPath,
    run: (...args) => spawnSync('python3', [splitter, '--segments', segmentPath, '--out', out, ...args], {
      cwd: dir, encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin:/usr/local/bin` },
    }),
    timeline: () => JSON.parse(readFileSync(join(out, 'timeline.json'), 'utf8')),
    calls: () => existsSync(events) ? readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse) : [],
  };
}

test('prepared narration reproduces the golden timeline without a provider or media tool', (t) => {
  const f = fixture(t);
  const result = f.run('--timeline-only');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.timeline(), JSON.parse(readFileSync(join(fixtures, 'timeline.golden.json'), 'utf8')));
  assert.deepEqual(f.calls(), []);
});

test('prepared audio is split locally and verification guidance uses the selected speech tool', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const timeline = f.timeline();
  assert.deepEqual(timeline.map(({ slug, start, end }) => [slug, start, end]), [
    ['hook', 0, 2.37], ['feature', 2.37, 4.67], ['close', 4.67, 7.5],
  ]);
  assert.equal(f.calls()[0].name, 'ffprobe');
  const cuts = f.calls().filter(({ name }) => name === 'ffmpeg');
  assert.equal(cuts.length, 3);
  for (const [i, call] of cuts.entries()) {
    assert.equal(call.args[call.args.indexOf('-i') + 1], join(f.out, 'narration-full.mp3'));
    assert.ok(existsSync(join(f.out, `${String(i + 1).padStart(2, '0')}-${timeline[i].slug}.mp3`)));
  }
  assert.match(result.stdout, /verify.*clip starts/i);
  assert.match(result.stdout, /selected.*(?:speech|transcription) tool/i);
  assert.doesNotMatch(result.stdout, /tts-oneshot/);
});

const word = (changes = {}) => ({ type: 'word', text: 'Welcome', start: 0, end: 1, ...changes });
for (const [label, transcript] of [
  ['no words array', { text: 'Welcome' }],
  ['empty words', { words: [] }],
  ['no timed words', { words: [{ type: 'spacing', text: ' ' }] }],
  ['missing start', { words: [{ type: 'word', text: 'Welcome', end: 1 }] }],
  ['text timestamps', { words: [word({ start: '0' })] }],
  ['boolean timestamps', { words: [word({ start: false })] }],
  ['negative timestamps', { words: [word({ start: -1 })] }],
  ['reversed timestamps', { words: [word({ start: 2, end: 1 })] }],
  ['missing text', { words: [word({ text: null })] }],
  ['unordered timestamps', { words: [word({ start: 2, end: 3 }), word()] }],
  ['overlapping timing after an unaligned word', { words: [word(), word({ text: '世界', start: 1, end: 10 }), word({ text: 'again', start: 2, end: 3 })] }],
]) {
  test(`narration rejects ${label} before producing media or a timeline`, (t) => {
    const f = fixture(t, { transcript, segments: [{ slug: 'hook', text: 'Welcome' }] });
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /transcript.*(?:words|text|timestamps)/i);
    assert.doesNotMatch(result.stderr, /Traceback/);
    assert.deepEqual(f.calls(), []);
    assert.equal(existsSync(join(f.out, 'timeline.json')), false);
  });
}

test('narration rejects word timestamps beyond the prepared audio duration before cutting', (t) => {
  const f = fixture(t, { duration: 0.5, transcript: { words: [word()] }, segments: [{ slug: 'hook', text: 'Welcome' }] });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /timestamps.*audio duration/i);
  assert.deepEqual(f.calls().map(({ name }) => name), ['ffprobe']);
  assert.equal(existsSync(join(f.out, 'timeline.json')), false);
});

test('audio duration checks include words skipped by the ASCII aligner', (t) => {
  const f = fixture(t, { transcript: { words: [word(), word({ text: '世界', start: 1, end: 10 })] }, segments: [{ slug: 'hook', text: 'Welcome' }] });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /timestamps.*audio duration/i);
  assert.deepEqual(f.calls().map(({ name }) => name), ['ffprobe']);
  assert.equal(existsSync(join(f.out, 'timeline.json')), false);
});

for (const count of [2, 3]) test(`narration rejects one timed word for ${count} scenes`, (t) => {
  const f = fixture(t, { transcript: { words: [word()] }, segments: [
    { slug: 'first', text: 'Welcome' }, { slug: 'second', text: 'Welcome' }, { slug: 'third', text: 'Welcome' },
  ].slice(0, count) });
  const result = f.run('--timeline-only');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scene boundaries/i);
  assert.equal(existsSync(join(f.out, 'timeline.json')), false);
});

test('narration identifies a malformed transcript without echoing its contents', (t) => {
  const f = fixture(t);
  const transcript = join(f.out, 'narration-full.stt.json');
  writeFileSync(transcript, '{"private narration draft":');
  const result = f.run('--timeline-only');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /transcript file.*valid JSON/i);
  assert.ok(result.stderr.includes(transcript));
  assert.doesNotMatch(result.stderr, /private narration draft|Traceback/);
});

test('narration identifies a missing prepared transcript before media work', (t) => {
  const f = fixture(t);
  const transcript = join(f.out, 'narration-full.stt.json');
  rmSync(transcript);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /transcript file not found/i);
  assert.ok(result.stderr.includes(transcript));
  assert.doesNotMatch(result.stderr, /Traceback/);
  assert.deepEqual(f.calls(), []);
});

test('narration identifies missing prepared audio before invoking media tools', (t) => {
  const f = fixture(t);
  const audio = join(f.out, 'narration-full.mp3');
  rmSync(audio);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /audio file not found/i);
  assert.ok(result.stderr.includes(audio));
  assert.doesNotMatch(result.stderr, /Traceback|returned non-zero/);
  assert.deepEqual(f.calls(), []);
  assert.equal(existsSync(join(f.out, 'timeline.json')), false);
});

test('timeline-only mode still works with just the script and transcript', (t) => {
  const f = fixture(t);
  rmSync(join(f.out, 'narration-full.mp3'));
  const result = f.run('--timeline-only');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.timeline(), JSON.parse(readFileSync(join(fixtures, 'timeline.golden.json'), 'utf8')));
  assert.deepEqual(f.calls(), []);
});

for (const [label, options] of [
  ['probe failure', { probeStatus: 1, probeError: 'private audio metadata', duration: '' }],
  ['nonnumeric duration', { duration: 'PRIVATE_DURATION_OUTPUT' }],
  ['unknown duration', { duration: 'N/A' }],
  ['not-a-number duration', { duration: 'nan' }],
  ['infinite duration', { duration: 'inf' }],
  ['zero duration', { duration: 0 }],
  ['negative duration', { duration: -1 }],
]) {
  test(`narration names the audio file and hides probe output for ${label}`, (t) => {
    const f = fixture(t, options);
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot read audio duration/i);
    assert.match(result.stderr, /valid audio file/i);
    assert.ok(result.stderr.includes(join(f.out, 'narration-full.mp3')));
    assert.doesNotMatch(result.stderr, /Traceback|returned non-zero|private audio metadata|PRIVATE_DURATION_OUTPUT/);
    assert.deepEqual(f.calls().map(({ name }) => name), ['ffprobe']);
    assert.equal(existsSync(join(f.out, 'timeline.json')), false);
  });
}
