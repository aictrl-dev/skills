/* One-shot narration: generate the FULL demo narration in a single ElevenLabs
 * TTS request (separate per-clip generation stutters at clip starts — even
 * with previous/next_text stitching), then transcribe it with word-level
 * timestamps for splitting (see split-narration.py).
 *
 * Usage:
 *   node tts-oneshot.cjs --segments demo/segments.json [--config demo/demo.config.json]
 *                        [--out demo/out/voice] [--skip-tts]
 *
 * segments.json: [{"slug": "hook", "text": "..."}, ...]
 * Key:   ELEVENLABS_API_KEY env (or ELEVENLABS_ENV_FILE=/path/to/.env containing it)
 * Voice: config.voice.voiceId, overridable via ELEVENLABS_VOICE_ID.
 * Model: config.voice.model (default eleven_v3 — most expressive; drop to
 *        eleven_multilingual_v2 if v3 ever destabilises the split), overridable
 *        via ELEVENLABS_MODEL.
 */
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const SEGMENTS_FILE = arg('segments', path.join(process.cwd(), 'demo/segments.json'));
const CONFIG_PATH = arg('config', path.join(path.dirname(SEGMENTS_FILE), 'demo.config.json'));
const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
const voiceCfg = config.voice || {};

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || voiceCfg.voiceId;
const MODEL = process.env.ELEVENLABS_MODEL || voiceCfg.model || 'eleven_v3';
const STT_LANG = process.env.ELEVENLABS_STT_LANG || voiceCfg.sttLang || 'en';
if (!VOICE_ID) {
  console.error('[oneshot] ERROR: no voice id — set config.voice.voiceId or ELEVENLABS_VOICE_ID (browse https://elevenlabs.io/app/voice-library)');
  process.exit(1);
}

const OUT = arg('out', path.join(path.dirname(SEGMENTS_FILE), 'out/voice'));
const FULL = path.join(OUT, 'narration-full.mp3');

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  // Optional: point ELEVENLABS_ENV_FILE at a dotenv-style file holding the key.
  const envFile = process.env.ELEVENLABS_ENV_FILE;
  if (envFile && fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('ELEVENLABS_API_KEY not set (export it, or set ELEVENLABS_ENV_FILE=/path/to/.env containing it)');
}

(async () => {
  const key = apiKey();
  const segments = JSON.parse(fs.readFileSync(SEGMENTS_FILE, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });

  if (!process.argv.includes('--skip-tts')) {
    const text = segments.map((s) => s.text).join('\n\n');
    console.log(`[oneshot] generating full narration (${text.length} chars, voice ${VOICE_ID}, model ${MODEL})...`);
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
        }),
      }
    );
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    fs.writeFileSync(FULL, Buffer.from(await res.arrayBuffer()));
    console.log('[oneshot] saved', FULL);
  }

  console.log('[oneshot] transcribing for word timestamps...');
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', STT_LANG);
  form.append('file', new Blob([fs.readFileSync(FULL)], { type: 'audio/mpeg' }), 'narration.mp3');
  const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });
  if (!sttRes.ok) throw new Error(`STT HTTP ${sttRes.status}: ${(await sttRes.text()).slice(0, 300)}`);
  const stt = await sttRes.json();
  fs.writeFileSync(path.join(OUT, 'narration-full.stt.json'), JSON.stringify(stt, null, 2));
  console.log(`[oneshot] transcript saved (${(stt.words || []).length} word tokens)`);
  console.log('[oneshot] done. Now run: python3 split-narration.py --segments', SEGMENTS_FILE, '--out', OUT);
})().catch((e) => {
  console.error('[oneshot] ERROR:', e.message);
  process.exit(1);
});
