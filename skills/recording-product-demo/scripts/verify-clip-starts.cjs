/* Transcribe the first four seconds of each numbered scene clip to verify split boundaries.
 *
 * Usage: node verify-clip-starts.cjs [--out demo/out/voice] [--config demo/demo.config.json]
 * Key: ELEVENLABS_API_KEY, explicitly supplied for ElevenLabs requests only. No credential files.
 * Language: ELEVENLABS_STT_LANG, then config.voice.sttLang, then en.
 * Config defaults to demo.config.json two directories above the voice output directory.
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

async function main() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set. Supply a key for ElevenLabs in the command environment; credential files are not read.');
  const out = path.resolve(arg('out', 'demo/out/voice'));
  const configArg = arg('config', null);
  const configPath = configArg ? path.resolve(configArg) : path.resolve(out, '../..', 'demo.config.json');
  const config = (configArg || fs.existsSync(configPath)) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
  const language = process.env.ELEVENLABS_STT_LANG || config.voice?.sttLang || 'en';
  // ffmpeg needs platform paths and locale settings, not the caller's provider credentials.
  const platformVars = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR',
    'LANG', 'LC_ALL', 'LC_CTYPE', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH'];
  const childEnv = Object.fromEntries(platformVars
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]]));
  const clips = fs.readdirSync(out).filter((name) => /^\d+-.*\.mp3$/.test(name)).sort();
  if (!clips.length) throw new Error('No numbered scene clips found; run split-narration.py first.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-clip-starts-'));
  try {
    const head = path.join(temp, 'head.mp3');
    for (const clip of clips) {
      try {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(out, clip),
          '-t', '4', '-c:a', 'libmp3lame', head], { stdio: ['ignore', 'ignore', 'pipe'], env: childEnv });
        const form = new FormData();
        form.append('model_id', 'scribe_v1');
        form.append('language_code', language);
        form.append('file', new Blob([fs.readFileSync(head)], { type: 'audio/mpeg' }), 'head.mp3');
        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST', redirect: 'error', headers: { 'xi-api-key': key }, body: form,
        });
        if (!response.ok) throw new Error(`STT HTTP ${response.status}`);
        let transcript;
        try { transcript = await response.json(); } catch { throw new Error('STT response is not JSON'); }
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

main().catch((e) => { console.error('[clip-starts] ERROR:', e.message); process.exit(1); });
