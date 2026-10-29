/* One-shot ElevenLabs narration with word timestamps, plus scene-start verification.
 *
 * Usage:
 *   node tts-oneshot.cjs --segments demo/segments.json [--config demo/demo.config.json]
 *                        [--out demo/out/voice] [--skip-tts]
 *   node tts-oneshot.cjs --verify-clip-starts [--out demo/out/voice]
 *                        [--config demo/demo.config.json]
 *
 * Key: ELEVENLABS_API_KEY, explicitly supplied for ElevenLabs requests only.
 * Voice/model: config.voice.voiceId/model, overridden by ELEVENLABS_VOICE_ID/MODEL.
 * Language: ELEVENLABS_STT_LANG, then config.voice.sttLang, then en.
 * Clip verification needs no voice ID; its default config is two directories
 * above the voice output directory. No credential files are read.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`--${name} requires ${name === 'out' ? 'a voice directory' : 'a config file'}`);
  }
  return value;
}

function shellQuote(value) {
  return "'" + String(value).replaceAll("'", "'\\''") + "'";
}

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  throw new Error('ELEVENLABS_API_KEY not set. Supply a key for ElevenLabs in the command environment; credential files are not read.');
}

async function transcribe(audio, key, language, filename) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', language);
  form.append('file', new Blob([fs.readFileSync(audio)], { type: 'audio/mpeg' }), filename);
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST', redirect: 'error', headers: { 'xi-api-key': key }, body: form,
  });
  if (!response.ok) throw new Error(`STT HTTP ${response.status}`);
  try { return await response.json(); } catch { throw new Error('STT response is not JSON'); }
}

async function verifyClipStarts(out, key, language) {
  const clips = fs.readdirSync(out).filter((name) => /^\d+-.*\.mp3$/.test(name)).sort();
  if (!clips.length) throw new Error('No numbered scene clips found; run split-narration.py first.');
  // Media tools receive platform paths and locale settings, never arbitrary caller credentials.
  const platformVars = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR',
    'LANG', 'LC_ALL', 'LC_CTYPE', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH'];
  const childEnv = Object.fromEntries(platformVars
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]]));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-clip-starts-'));
  try {
    const head = path.join(temp, 'head.mp3');
    for (const clip of clips) {
      try {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(out, clip),
          '-t', '4', '-c:a', 'libmp3lame', head], { stdio: ['ignore', 'ignore', 'pipe'], env: childEnv });
        const transcript = await transcribe(head, key, language, 'head.mp3');
        if (typeof transcript?.text !== 'string') throw new Error('STT response is missing string text');
        console.log(JSON.stringify({ clip, text: transcript.text }));
      } catch (e) {
        throw new Error(`${JSON.stringify(clip)}: ${e.message}`);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function main() {
  const verify = process.argv.includes('--verify-clip-starts');
  const segmentsFile = arg('segments', path.join(process.cwd(), 'demo/segments.json'));
  const out = path.resolve(arg('out', path.join(path.dirname(segmentsFile), 'out/voice')));
  const configArg = arg('config', null);
  const defaultConfig = verify ? path.resolve(out, '../..', 'demo.config.json') : path.join(path.dirname(segmentsFile), 'demo.config.json');
  const configPath = configArg || defaultConfig;
  let config = {};
  if (fs.existsSync(configPath) || (verify && configArg !== null)) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const voiceCfg = config.voice || {};
  const language = process.env.ELEVENLABS_STT_LANG || voiceCfg.sttLang || 'en';

  if (verify) {
    await verifyClipStarts(out, apiKey(), language);
    return;
  }

  const voice = process.env.ELEVENLABS_VOICE_ID || voiceCfg.voiceId;
  const model = process.env.ELEVENLABS_MODEL || voiceCfg.model || 'eleven_v3';
  if (!voice) throw new Error('no voice id — set config.voice.voiceId or ELEVENLABS_VOICE_ID (browse https://elevenlabs.io/app/voice-library)');
  const key = apiKey();
  const segments = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const full = path.join(out, 'narration-full.mp3');
  fs.mkdirSync(out, { recursive: true });

  if (!process.argv.includes('--skip-tts')) {
    const text = segments.map((s) => s.text).join('\n\n');
    console.log(`[oneshot] generating full narration (${text.length} chars, voice ${voice}, model ${model})...`);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST', redirect: 'error', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true } }),
    });
    if (!response.ok) throw new Error(`TTS HTTP ${response.status}`);
    fs.writeFileSync(full, Buffer.from(await response.arrayBuffer()));
    console.log('[oneshot] saved', full);
  }

  console.log('[oneshot] transcribing for word timestamps...');
  const stt = await transcribe(full, key, language, 'narration.mp3');
  fs.writeFileSync(path.join(out, 'narration-full.stt.json'), JSON.stringify(stt, null, 2));
  console.log(`[oneshot] transcript saved (${(stt.words || []).length} word tokens)`);
  const next = ['python3', path.join(__dirname, 'split-narration.py'), '--segments', segmentsFile, '--out', out];
  if (configArg !== null || fs.existsSync(configPath)) next.push('--config', configPath);
  console.log('[oneshot] done. Now run:', next.map(shellQuote).join(' '));
}

main().catch((e) => { console.error('[oneshot] ERROR:', e.message); process.exit(1); });
