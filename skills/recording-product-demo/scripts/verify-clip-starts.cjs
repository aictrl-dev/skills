// Transcribe the first four seconds of each numbered scene clip to verify split boundaries.
// Usage: node verify-clip-starts.cjs [--out demo/out/voice]
// Only an explicitly supplied ELEVENLABS_API_KEY is used, only with ElevenLabs. No credential files.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

async function main() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set. Supply a key for ElevenLabs in the command environment; credential files are not read.');
  const i = process.argv.indexOf('--out');
  if (i >= 0 && !process.argv[i + 1]) throw new Error('--out requires a voice directory');
  const out = path.resolve(i >= 0 ? process.argv[i + 1] : 'demo/out/voice');
  const clips = fs.readdirSync(out).filter((name) => /^\d+-.*\.mp3$/.test(name)).sort();
  if (!clips.length) throw new Error('No numbered scene clips found; run split-narration.py first.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-clip-starts-'));
  try {
    const head = path.join(temp, 'head.mp3');
    for (const clip of clips) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(out, clip),
        '-t', '4', '-c:a', 'libmp3lame', head], { stdio: ['ignore', 'ignore', 'pipe'] });
      const form = new FormData();
      form.append('model_id', 'scribe_v1');
      form.append('language_code', process.env.ELEVENLABS_STT_LANG || 'en');
      form.append('file', new Blob([fs.readFileSync(head)], { type: 'audio/mpeg' }), 'head.mp3');
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST', redirect: 'error', headers: { 'xi-api-key': key }, body: form,
      });
      if (!response.ok) throw new Error(`STT HTTP ${response.status}`);
      const transcript = await response.json();
      console.log(JSON.stringify({ clip, text: transcript.text }));
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error('[clip-starts] ERROR:', e.message); process.exit(1); });
