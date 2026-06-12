/* Dump rendered page text from (optionally authenticated) pages — use it to
 * sync live numbers into the narration BEFORE generating audio, and to find
 * the on-screen strings the recorder blocks will anchor on.
 *
 * Usage:
 *   node scrape-text.cjs <url> [<url>...] [--profile <dir> | --state <auth-state.json>] [--chars 3500]
 *
 * Gotcha: 'networkidle' never fires on pages holding an SSE/websocket stream —
 * this script uses domcontentloaded + a fixed settle wait instead.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

function resolvePlaywright() {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'playwright'),
    'playwright',
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
const PROFILE = arg('profile', null);
const STATE = arg('state', null);
const CHARS = Number(arg('chars', '3500'));
const flagsWithValue = new Set(['--profile', '--state', '--chars']);
const urls = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !flagsWithValue.has(all[i - 1]));

if (!urls.length) {
  console.error('Usage: node scrape-text.cjs <url> [<url>...] [--profile dir | --state file]');
  process.exit(64);
}

(async () => {
  let browser = null, ctx;
  const opts = { viewport: { width: 1536, height: 2000 } };
  if (PROFILE) {
    ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, ...opts });
  } else {
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext(STATE && fs.existsSync(STATE) ? { storageState: STATE, ...opts } : opts);
  }
  const page = ctx.pages?.()[0] || (await ctx.newPage());
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    console.log(`\n===== ${url} =====`);
    console.log(text.replace(/\n{2,}/g, '\n').slice(0, CHARS));
  }
  await ctx.close();
  if (browser) await browser.close();
})().catch((e) => {
  console.error('[scrape] ERROR:', e.message);
  process.exit(1);
});
