/* Assemble the final demo MP4 from the recorded take + narration + cards.
 * Reads t0/boundaries from out/take-meta.json (written by record-demo.cjs)
 * and probes card VO durations itself, so nothing is copied by hand between
 * rebuilds.
 *
 * Usage:
 *   node assemble.cjs [--build demo] [--no-cards] [--skip-grid] [--dry-run]
 *
 * Expects in <build dir> (default: ./demo):
 *   out/take-meta.json            from record-demo.cjs
 *   out/voice/narration-full.mp3  from tts-oneshot.cjs
 *   out/voice/timeline.json       from split-narration.py
 *   cards/title.png agenda.png end.png  rendered cards (unless --no-cards)
 *   out/voice/intro.mp3           agenda VO (unless --no-cards)
 *   out/voice/welcome.mp3         OPTIONAL title VO (silent 4.2s title if absent)
 *
 * Produces: out/main.mp4 (demo only), out/final.mp4 (cards + demo),
 *           out/frames/grid.png (scene-midpoint verification grid).
 * --dry-run prints the ffmpeg invocations as JSON without executing (used by
 * the skill's eval).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const BUILD = path.resolve(arg('build', path.join(process.cwd(), 'demo')));
const NO_CARDS = process.argv.includes('--no-cards');
const SKIP_GRID = process.argv.includes('--skip-grid');
const DRY_RUN = process.argv.includes('--dry-run');

// Must match the recorder's viewport / upscale convention (record small,
// upscale here — Playwright letterboxes instead of upscaling).
const meta0 = JSON.parse(fs.readFileSync(path.join(BUILD, 'out/take-meta.json'), 'utf8'));
const [vw, vh] = meta0.viewport || [1536, 864];
const [ow, oh] = meta0.output || [1920, 1080];
const CROP = `crop=${vw}:${vh}:0:0`;
const UPSCALE = `scale=${ow}:${oh}:flags=lanczos,unsharp=5:5:0.4`;
const AFMT = 'aformat=sample_fmts=fltp:channel_layouts=mono:sample_rates=44100';
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k'];

const planned = []; // collected for --dry-run
function run(cmd, args) {
  if (DRY_RUN) { planned.push({ cmd, args }); return ''; }
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    console.error(`[asm] ERROR: ${cmd} failed:\n${r.stderr.toString().slice(-1500)}`);
    process.exit(1);
  }
  return r.stdout.toString();
}
const ffmpeg = (args) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const probeDur = (f) => (DRY_RUN ? 10 : Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim()));

function need(rel) {
  const p = path.join(BUILD, rel);
  if (!fs.existsSync(p) && !DRY_RUN) {
    console.error(`[asm] ERROR: missing ${rel} in ${BUILD} — run the earlier phases first.`);
    process.exit(1);
  }
  return p;
}

// ---- inputs ----
const meta = meta0;
const narration = need('out/voice/narration-full.mp3');
const timeline = JSON.parse(fs.readFileSync(need('out/voice/timeline.json'), 'utf8'));
const T0 = meta.t0Seconds;
const END = meta.narrationEnd;
const mainOut = path.join(BUILD, 'out/main.mp4');
console.log(`[asm] take: ${path.basename(meta.webm)}  t0=${T0}s  narration end=${END}s`);

// ---- 1. mux: trim head at t0, upscale, lay narration, fade out ----
ffmpeg([
  '-ss', String(T0), '-i', meta.webm, '-i', narration,
  '-filter_complex',
  `[0:v]${CROP},${UPSCALE},fade=t=out:st=${(END - 1.1).toFixed(2)}:d=1.1[v];[1:a]adelay=200|200,apad[a]`,
  '-map', '[v]', '-map', '[a]', '-t', (END + 1.4).toFixed(2), ...ENC, mainOut,
]);
if (!DRY_RUN) console.log(`[asm] main.mp4: ${probeDur(mainOut).toFixed(1)}s`);

// ---- 2. cards + concat ----
if (!NO_CARDS) {
  const title = need('cards/title.png');
  const agenda = need('cards/agenda.png');
  const end = need('cards/end.png');
  const intro = need('out/voice/intro.mp3');
  const welcomePath = path.join(BUILD, 'out/voice/welcome.mp3');
  const hasWelcome = fs.existsSync(welcomePath);

  const introDur = probeDur(intro);
  const titleDur = hasWelcome ? probeDur(welcomePath) + 1.7 : 4.2; // 0.8s adelay + VO + tail
  const agendaDur = introDur + 1.7;
  console.log(`[asm] cards: title=${titleDur.toFixed(1)}s (${hasWelcome ? 'voiced' : 'silent'})  agenda=${agendaDur.toFixed(1)}s  end=5.5s`);

  const inputs = [
    '-loop', '1', '-framerate', '30', '-t', titleDur.toFixed(2), '-i', title,
    '-loop', '1', '-framerate', '30', '-t', agendaDur.toFixed(2), '-i', agenda,
    '-i', mainOut,
    '-loop', '1', '-framerate', '30', '-t', '5.5', '-i', end,
    '-i', intro,
    '-f', 'lavfi', '-t', '5.5', '-i', 'anullsrc=r=44100:cl=mono',
  ];
  let titleA;
  if (hasWelcome) {
    inputs.push('-i', welcomePath); // input 6
    titleA = `[6:a]adelay=800|800,apad,atrim=duration=${titleDur.toFixed(2)},${AFMT}[a0]`;
  } else {
    inputs.push('-f', 'lavfi', '-t', titleDur.toFixed(2), '-i', 'anullsrc=r=44100:cl=mono'); // input 6
    titleA = `[6:a]${AFMT}[a0]`;
  }
  const fc = [
    `[0:v]format=yuv420p,setsar=1,fade=t=in:st=0:d=0.6,fade=t=out:st=${(titleDur - 0.5).toFixed(2)}:d=0.5[v0]`,
    `[1:v]format=yuv420p,setsar=1,fade=t=in:st=0:d=0.4,fade=t=out:st=${(agendaDur - 0.5).toFixed(2)}:d=0.5[v1]`,
    '[3:v]format=yuv420p,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=4.6:d=0.9[v3]',
    titleA,
    `[4:a]adelay=800|800,apad,atrim=duration=${agendaDur.toFixed(2)},${AFMT}[a1]`,
    `[2:a]${AFMT}[a2]`,
    `[5:a]${AFMT}[a3]`,
    '[v0][a0][v1][a1][2:v][a2][v3][a3]concat=n=4:v=1:a=1[v][a]',
  ].join(';');
  const finalOut = path.join(BUILD, 'out/final.mp4');
  ffmpeg([...inputs, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', ...ENC, finalOut]);
  if (!DRY_RUN) console.log(`[asm] final.mp4: ${probeDur(finalOut).toFixed(1)}s`);
}

// ---- 3. verification frame grid (scene midpoints from main.mp4) ----
if (!SKIP_GRID) {
  const framesDir = path.join(BUILD, 'out/frames');
  if (!DRY_RUN) fs.mkdirSync(framesDir, { recursive: true });
  const mids = timeline.map((s) => (s.start + s.end) / 2);
  mids.forEach((t, i) => {
    ffmpeg(['-ss', t.toFixed(1), '-i', mainOut, '-vf', 'scale=480:-1', '-frames:v', '1',
      path.join(framesDir, `fr-${String(i + 1).padStart(2, '0')}.png`)]);
  });
  const cols = 2, rows = Math.ceil(mids.length / cols);
  ffmpeg(['-pattern_type', 'glob', '-i', path.join(framesDir, 'fr-*.png'),
    '-filter_complex', `tile=${cols}x${rows}`, '-frames:v', '1', path.join(framesDir, 'grid.png')]);
  console.log(`[asm] frame grid: ${path.join(framesDir, 'grid.png')} — EYEBALL IT: every scene on the right page?`);
}

if (DRY_RUN) {
  // single marked line — machine-parseable regardless of the log lines above
  console.log('DRY-RUN-PLAN ' + JSON.stringify(planned));
} else {
  console.log('[asm] done.');
}
