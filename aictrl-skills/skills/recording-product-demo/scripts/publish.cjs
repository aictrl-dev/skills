/* Build a ready-to-publish kit from the assembled demo, and optionally upload
 * it to a configured destination.
 *
 * Usage:
 *   node publish.cjs [--build demo] [--config demo/demo.config.json] [--skip-upload]
 *
 * Produces in <build>/out/publish/:
 *   demo.mp4          faststart remux of final.mp4 (plays before fully downloaded)
 *   demo-720p.mp4     smaller web/mobile variant
 *   poster.jpg        frame for <video poster> / link previews
 *   captions.srt      built from the STT word timestamps (feed-video autoplay
 *                     is MUTED on social platforms — captions are non-negotiable)
 *   embed.html        responsive same-origin <video> snippet
 *   PUBLISH.md        what to do next (YouTube / LinkedIn / website guidance)
 *
 * Upload (config.publish.upload):
 *   null                                  → kit only (default)
 *   {"type":"gcs","path":"gs://bucket/dir"}   → gcloud storage cp (gcloud CLI required)
 *   {"type":"s3","path":"s3://bucket/dir"}    → aws s3 cp (aws CLI required)
 *   {"type":"youtube","privacy":"unlisted"}   → YouTube Data API resumable upload;
 *       needs env YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (one-time
 *       OAuth provisioning on the channel; see PUBLISH.md for the steps)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const BUILD = path.resolve(arg('build', path.join(process.cwd(), 'demo')));
const CONFIG_PATH = arg('config', path.join(BUILD, 'demo.config.json'));
const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
const SKIP_UPLOAD = process.argv.includes('--skip-upload');

const FINAL = path.join(BUILD, 'out/final.mp4');
const STT = path.join(BUILD, 'out/voice/narration-full.stt.json');
const PUB = path.join(BUILD, 'out/publish');
if (!fs.existsSync(FINAL)) {
  console.error(`[pub] ERROR: ${FINAL} not found — run assemble.cjs first.`);
  process.exit(1);
}
fs.mkdirSync(PUB, { recursive: true });

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  if (r.status !== 0) {
    console.error(`[pub] ERROR: ${cmd} failed:\n${r.stderr.toString().slice(-1200)}`);
    process.exit(1);
  }
  return r.stdout.toString();
}
const ffmpeg = (args) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

// ---- 1. web-optimized variants + poster ----
const demoMp4 = path.join(PUB, 'demo.mp4');
ffmpeg(['-i', FINAL, '-c', 'copy', '-movflags', '+faststart', demoMp4]);
ffmpeg(['-i', FINAL, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-crf', '23',
  '-preset', 'medium', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k',
  path.join(PUB, 'demo-720p.mp4')]);
ffmpeg(['-ss', '2', '-i', FINAL, '-frames:v', '1', '-q:v', '3', path.join(PUB, 'poster.jpg')]);
console.log('[pub] demo.mp4 (faststart), demo-720p.mp4, poster.jpg');

// ---- 2. captions.srt from STT word timestamps ----
// The narration audio in final.mp4 starts AFTER the title/agenda cards; the
// cards' own VO isn't in the stt.json, so we caption the main narration and
// offset it by the card lead-in (probe: final duration - main duration).
if (fs.existsSync(STT)) {
  const probe = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());
  const mainPath = path.join(BUILD, 'out/main.mp4');
  const offset = fs.existsSync(mainPath) ? probe(FINAL) - probe(mainPath) : 0;
  const audioDelay = 0.2; // assemble.cjs adelay=200 on the narration
  const words = JSON.parse(fs.readFileSync(STT, 'utf8')).words.filter((w) => w.type === 'word');
  const cues = [];
  for (let i = 0; i < words.length; i += 8) {
    const group = words.slice(i, i + 8);
    cues.push({
      start: group[0].start + offset + audioDelay,
      end: group[group.length - 1].end + offset + audioDelay,
      text: group.map((w) => w.text).join(' '),
    });
  }
  const ts = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    const ms = String(Math.round((s % 1) * 1000)).padStart(3, '0');
    return `${h}:${m}:${sec},${ms}`;
  };
  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n');
  fs.writeFileSync(path.join(PUB, 'captions.srt'), srt);
  console.log(`[pub] captions.srt (${cues.length} cues, offset ${offset.toFixed(1)}s for the intro cards)`);
} else {
  console.log('[pub] no stt.json — skipping captions.srt');
}

// ---- 3. embed snippet + next-steps doc ----
const appName = config.app?.name || 'Product';
fs.writeFileSync(path.join(PUB, 'embed.html'), `<!-- Same-origin <video> embed: host demo-720p.mp4 + poster.jpg on your site/CDN.
     preload="metadata" = nothing downloads until play. -->
<video controls preload="metadata" playsinline
       poster="/media/poster.jpg"
       style="width:100%;max-width:960px;border-radius:12px">
  <source src="/media/demo-720p.mp4" type="video/mp4">
  <track kind="captions" src="/media/captions.srt" srclang="en" label="English">
</video>
`);
fs.writeFileSync(path.join(PUB, 'PUBLISH.md'), `# Publish kit — ${appName} demo

| File | Use |
|------|-----|
| demo.mp4 | Full-quality faststart MP4 — upload THIS to YouTube (it re-encodes) |
| demo-720p.mp4 | Smaller variant for self-hosting / LinkedIn native upload |
| poster.jpg | \`<video poster>\` / link preview image |
| captions.srt | Captions — attach on YouTube and LinkedIn (feed autoplay is muted) |
| embed.html | Responsive same-origin embed snippet for your site |

## YouTube
Upload demo.mp4 (Unlisted if it's for embedding only), attach captions.srt.
For privacy-friendly site embeds use \`https://www.youtube-nocookie.com/embed/<ID>?rel=0\`
with \`referrerpolicy="no-referrer"\` and \`loading="lazy"\`.

## LinkedIn (company page)
Do NOT post a YouTube link — feed ranking punishes outbound links and a link
renders as a static preview. Upload the MP4 natively (consider a 60–90s teaser
cut), attach captions.srt, put the full-video link in the FIRST COMMENT.

## YouTube API upload (optional automation)
Set \`publish.upload = {"type":"youtube","privacy":"unlisted"}\` in
demo.config.json and provision once: create an OAuth client (YouTube Data API
v3, scope youtube.upload), obtain a refresh token for the channel, export
YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN, re-run publish.cjs.
`);
console.log('[pub] embed.html, PUBLISH.md');

// ---- 4. optional upload ----
const upload = config.publish?.upload;
(async () => {
  if (!upload || SKIP_UPLOAD) {
    console.log(`[pub] kit ready: ${PUB}${upload ? ' (upload skipped)' : ' (no upload configured)'}`);
    return;
  }
  if (upload.type === 'gcs') {
    run('gcloud', ['storage', 'cp', '-r', PUB + path.sep + '*', upload.path], { shell: true });
    console.log('[pub] uploaded to', upload.path);
  } else if (upload.type === 's3') {
    run('aws', ['s3', 'cp', PUB, upload.path, '--recursive']);
    console.log('[pub] uploaded to', upload.path);
  } else if (upload.type === 'youtube') {
    const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
    if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
      console.error('[pub] ERROR: youtube upload needs YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN (see PUBLISH.md)');
      process.exit(1);
    }
    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
        refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token',
      }),
    });
    if (!tokRes.ok) throw new Error(`token exchange HTTP ${tokRes.status}: ${(await tokRes.text()).slice(0, 200)}`);
    const { access_token } = await tokRes.json();
    const metaPart = {
      snippet: { title: upload.title || `${appName} — product demo`, description: upload.description || '' },
      status: { privacyStatus: upload.privacy || 'unlisted' },
    };
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPart),
      }
    );
    if (!initRes.ok) throw new Error(`upload init HTTP ${initRes.status}: ${(await initRes.text()).slice(0, 300)}`);
    const sessionUrl = initRes.headers.get('location');
    const buf = fs.readFileSync(demoMp4);
    const upRes = await fetch(sessionUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(buf.length) },
      body: buf,
    });
    if (!upRes.ok) throw new Error(`upload HTTP ${upRes.status}: ${(await upRes.text()).slice(0, 300)}`);
    const video = await upRes.json();
    console.log(`[pub] uploaded to YouTube: https://youtu.be/${video.id} (${metaPart.status.privacyStatus})`);
  } else {
    console.error(`[pub] ERROR: unknown upload type "${upload.type}" (gcs | s3 | youtube)`);
    process.exit(1);
  }
})().catch((e) => {
  console.error('[pub] ERROR:', e.message);
  process.exit(1);
});
