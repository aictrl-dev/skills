/* Continuous demo recorder (FRAMEWORK) — ONE take of the whole demo journey,
 * time-locked to the narration boundaries from timeline.json (written by
 * split-narration.py).
 *
 * This file is the engine. The per-repo journey lives in the host repo at
 * demo/blocks.cjs and is loaded at runtime:
 *
 *   // demo/blocks.cjs
 *   module.exports = async function run(api) {
 *     const { page, config, B, until, glideTo, slowWheel, setT0 } = api;
 *     await page.goto(config.app.baseUrl + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
 *     setT0();                       // narration starts NOW — exact head-trim for the mux
 *     await glideTo(page.getByText(/Welcome/).first(), 1000);
 *     await until(B[1]);             // every scene MUST end on its boundary
 *     // ... one block per narration segment ...
 *     await until(B[B.length - 1] + 1.2); // hold past narration end for the fade
 *   };
 *
 * Usage:
 *   node record-demo.cjs [--config demo/demo.config.json] [--blocks demo/blocks.cjs]
 *                        [--timeline demo/out/voice/timeline.json] [--out demo/out] [--no-anon]
 *
 * Conventions that took real debugging to learn — do not "simplify" them:
 * - Playwright NEVER upscales video (recordVideo.size bigger than the viewport
 *   = letterboxing; deviceScaleFactor does not help). Record at a smaller
 *   viewport and upscale in ffmpeg (assemble.cjs does this).
 * - waitUntil: 'domcontentloaded' (NOT 'networkidle' — pages holding an SSE or
 *   websocket stream never go idle) + explicit element waits.
 * - setDefaultTimeout(6000): a missing element must cost seconds, not the
 *   default 30s, or the time-locked take is ruined.
 * - A take with "WARN: block overran" lines is garbage; fix the blocks and re-run.
 * - t0 (from api.setT0()) is written to out/take-meta.json — assemble.cjs
 *   reads it for the head-trim, nothing is copied by hand.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

function resolvePlaywright() {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'playwright'), // host repo
    'playwright', // anywhere on the resolution path
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('playwright not found — run `npm i -D playwright && npx playwright install chromium` in the host repo');
}
const { chromium } = resolvePlaywright();

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const CONFIG_PATH = arg('config', path.join(process.cwd(), 'demo/demo.config.json'));
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`[rec] ERROR: config not found at ${CONFIG_PATH} — run the skill's Phase 0 to generate demo/`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const DEMO_DIR = path.dirname(CONFIG_PATH);

const BLOCKS_PATH = path.resolve(arg('blocks', path.join(DEMO_DIR, 'blocks.cjs')));
const TIMELINE = arg('timeline', path.join(DEMO_DIR, 'out/voice/timeline.json'));
const OUT_DIR = arg('out', path.join(DEMO_DIR, 'out'));
const ANONYMIZE = !process.argv.includes('--no-anon') && (config.anonymize?.enabled ?? false);

const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

// Boundaries: starts of all segments + end of the last one.
const timeline = JSON.parse(fs.readFileSync(TIMELINE, 'utf8'));
const B = [...timeline.map((s) => s.start), timeline[timeline.length - 1].end];
console.log('[rec] boundaries:', B.map((b) => b.toFixed(1)).join(' '));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const rec = config.record || {};
  const [vw, vh] = rec.viewport || [1536, 864];
  const [ow, oh] = rec.output || [1920, 1080];
  const ctxOpts = {
    viewport: { width: vw, height: vh },
    deviceScaleFactor: 2,
    locale: rec.locale || 'en-GB',
    recordVideo: { dir: OUT_DIR, size: { width: ow, height: oh } },
  };

  const auth = config.auth || { mode: 'none' };
  let browser = null, ctx, page;
  if (auth.mode === 'profile') {
    // SPA auth often lives in IndexedDB (e.g. Firebase), which storageState
    // CANNOT capture — the persistent login profile carries cookies +
    // localStorage + IndexedDB. Capture it once with login.cjs.
    const profileDir = expandHome(auth.profileDir) || path.join(os.homedir(), '.cache/product-demo/chrome-profile');
    console.log('[rec] auth=profile:', profileDir);
    ctx = await chromium.launchPersistentContext(profileDir, { headless: true, ...ctxOpts });
    page = ctx.pages()[0] || (await ctx.newPage());
  } else if (auth.mode === 'storageState') {
    const statePath = expandHome(auth.statePath) || path.join(os.homedir(), '.cache/product-demo/auth-state.json');
    console.log('[rec] auth=storageState:', statePath);
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext({ storageState: statePath, ...ctxOpts });
    page = await ctx.newPage();
  } else {
    console.log('[rec] auth=none');
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext(ctxOpts);
    page = await ctx.newPage();
  }
  page.setDefaultTimeout(6000);
  const recStart = Date.now();

  // visible cursor + hidden scrollbars on every page
  const cursorColor = config.brand?.color || '#4c6ef5';
  await page.addInitScript((color) => {
    window.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = '::-webkit-scrollbar{display:none} html{scrollbar-width:none}';
      document.head.appendChild(s);
      const c = document.createElement('div');
      Object.assign(c.style, {
        position: 'fixed', left: '-50px', top: '-50px', width: '22px', height: '22px',
        border: `2px solid ${color}`, background: `${color}4d`,
        borderRadius: '50%', zIndex: 2147483647, pointerEvents: 'none',
        transform: 'translate(-50%,-50%)', boxShadow: `0 0 0 4px ${color}1f`,
      });
      document.body.appendChild(c);
      window.addEventListener('mousemove', (e) => {
        c.style.left = e.clientX + 'px';
        c.style.top = e.clientY + 'px';
      }, true);
    });
  }, cursorColor);

  // anonymise identifying text + operator face avatars, live during capture.
  // The underlying app data is NOT modified — only what the recording sees.
  if (ANONYMIZE) {
    console.log('[rec] anonymisation ON');
    await page.addInitScript((cfg) => {
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rules = (cfg.textMap || []).map(([f, t]) => [new RegExp(esc(f), 'gi'), t]);
      const isFace = (img) => {
        const s = img.getAttribute('src') || '';
        const meta = ((img.getAttribute('alt') || '') + '|' + (img.getAttribute('title') || '')).toLowerCase();
        if ((cfg.keepSrcParts || []).some((p) => s.includes(p))) return false;
        if ((cfg.faceSrcParts || []).some((p) => s.includes(p))) return true;
        return (cfg.textMap || []).some(([f]) => meta.includes(f.toLowerCase()));
      };
      const fixImg = (img) => {
        if (img.__anon || !isFace(img)) return;
        img.__anon = 1;
        img.setAttribute('src', cfg.avatar);
        img.removeAttribute('srcset');
        if (cfg.textMap && cfg.textMap[0]) img.setAttribute('alt', cfg.textMap[0][1]);
      };
      const fixInitial = (el) => {
        if (el.__anoni || el.children.length) return;
        const hit = (cfg.initials || []).find(([f]) => f === (el.textContent || '').trim());
        if (hit) { el.__anoni = 1; el.textContent = hit[1]; }
      };
      const fixText = (node) => {
        const v = node.nodeValue;
        if (!v) return;
        let nv = v;
        for (const [re, t] of rules) nv = nv.replace(re, t);
        if (nv !== v) node.nodeValue = nv;
      };
      const walk = (root) => {
        if (!root) return;
        if (root.nodeType === 3) { fixText(root); return; }
        if (root.nodeType !== 1) return;
        if (root.tagName === 'IMG') fixImg(root);
        if (root.querySelectorAll) {
          root.querySelectorAll('img').forEach(fixImg);
          root.querySelectorAll('[class*="avatar" i]').forEach(fixInitial);
        }
        if (/avatar/i.test(root.className || '')) fixInitial(root);
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const ns = []; let n;
        while ((n = tw.nextNode())) ns.push(n);
        ns.forEach(fixText);
      };
      const start = () => {
        walk(document.body);
        new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type === 'characterData') { fixText(m.target); continue; }
            m.addedNodes && m.addedNodes.forEach(walk);
          }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      };
      if (document.body) start();
      else document.addEventListener('DOMContentLoaded', start);
    }, {
      avatar: config.anonymize.avatar ||
        ('data:image/svg+xml;utf8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="${cursorColor}"/><circle cx="40" cy="33" r="13" fill="#ffffff"/><path d="M17 69c3-14 12-21 23-21s20 7 23 21z" fill="#ffffff"/></svg>`)),
      textMap: config.anonymize.textMap || [],
      faceSrcParts: config.anonymize.faceSrcParts || [],
      keepSrcParts: config.anonymize.keepSrcParts || [],
      initials: config.anonymize.initials || [],
    });
  }

  // ---- the api handed to demo/blocks.cjs ----
  let t0 = 0;
  const setT0 = () => {
    t0 = Date.now();
    console.log(`[rec] t0 set at ${((t0 - recStart) / 1000).toFixed(2)}s into recording`);
  };
  const until = async (t) => {
    if (!t0) { console.log('[rec] WARN: until() before setT0() — call setT0() when narration starts'); setT0(); }
    const ms = t0 + t * 1000 - Date.now();
    if (ms > 0) await sleep(ms);
    else console.log(`[rec] WARN: block overran by ${(-ms / 1000).toFixed(1)}s (target ${t}s)`);
  };
  async function glide(to, durationMs) {
    const from = page.__cursor || { x: Math.round(vw / 2), y: 200 };
    const steps = Math.max(12, Math.round(durationMs / 25));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
      await sleep(durationMs / steps);
    }
    page.__cursor = to;
  }
  async function glideTo(locator, durationMs, dy = 0, timeoutMs = 2000) {
    try {
      const box = await locator.boundingBox({ timeout: timeoutMs });
      if (!box) throw new Error('not visible');
      await glide({ x: box.x + box.width / 2, y: box.y + box.height / 2 + dy }, durationMs);
      return true;
    } catch (e) {
      console.log(`[rec] WARN glideTo failed: ${e.message.split('\n')[0]}`);
      return false;
    }
  }
  async function slowWheel(totalPx, durationMs) {
    const steps = Math.max(5, Math.round(durationMs / 120));
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, totalPx / steps);
      await sleep(durationMs / steps);
    }
  }

  // ---- run the host repo's journey ----
  if (!fs.existsSync(BLOCKS_PATH)) {
    console.error(`[rec] ERROR: blocks file not found at ${BLOCKS_PATH} — write the journey first (see templates/blocks.example.cjs)`);
    process.exit(1);
  }
  const run = require(BLOCKS_PATH);
  await run({ page, config, B, timeline, until, sleep, glide, glideTo, slowWheel, setT0 });

  console.log('[rec] done, saving video...');
  const video = page.video();
  await ctx.close();
  const p = await video.path();
  if (browser) await browser.close();
  console.log('[rec] webm:', p);

  // Machine-readable take metadata — consumed by assemble.cjs.
  const meta = {
    webm: p,
    t0Seconds: Number(((t0 - recStart) / 1000).toFixed(2)),
    narrationEnd: B[B.length - 1],
    boundaries: B,
    recordedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'take-meta.json'), JSON.stringify(meta, null, 2));
  console.log('[rec] take-meta.json written (t0 =', meta.t0Seconds + 's)');
})().catch((e) => {
  console.error('[rec] ERROR:', e.message);
  process.exit(1);
});
