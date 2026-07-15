/* Interactive auth capture for demo recording.
 *
 * Opens REAL Chrome with the automation fingerprint disabled (passes Google's
 * "This browser or app may not be secure" check), lets the user log in once,
 * then saves the profile + a storageState snapshot for headless recording runs.
 *
 * Usage:
 *   node login.cjs --url <start-url> --expect <text-visible-when-logged-in>
 *        [--profile <dir>] [--state <file>] [--timeout-min 5]
 *
 * GOTCHAS (each cost real debugging):
 * - `--expect` must be an AUTHENTICATED-ONLY string. If the logged-out page
 *   contains the same words (marketing pages often do), the script declares
 *   success before you log in and saves a logged-out session.
 * - storageState captures cookies + localStorage but NOT IndexedDB — SPAs
 *   whose auth token lives in IndexedDB (e.g. Firebase) will render logged-out
 *   headless. For those, set auth.mode="profile" in demo.config.json: the
 *   recorder then reuses this script's persistent Chrome profile, which
 *   carries IndexedDB too.
 * - storageState only captures localStorage for origins visited in THIS
 *   session. If the app keeps critical state in localStorage (selected
 *   org/workspace), inject it into the state file afterwards.
 * - Multiple passes (app login, then GitHub, etc.) accumulate in the SAME
 *   profile — run this script once per origin that needs auth.
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

const URL = arg('url');
const EXPECT = arg('expect');
const PROFILE_DIR = arg('profile', path.join(os.homedir(), '.cache/product-demo/chrome-profile'));
const AUTH_STATE = arg('state', path.join(os.homedir(), '.cache/product-demo/auth-state.json'));
const TIMEOUT_MIN = Number(arg('timeout-min', '5'));

if (!URL || !EXPECT) {
  console.error('Usage: node login.cjs --url <url> --expect <logged-in-only text> [--profile dir] [--state file]');
  process.exit(64);
}

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled', '--window-size=1700,1000'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  console.log('[login] Window open. Complete the login in it.');
  console.log(`[login] Waiting until "${EXPECT}" is visible (max ${TIMEOUT_MIN} min)...`);

  const deadline = Date.now() + TIMEOUT_MIN * 60 * 1000;
  let ok = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let visible = false;
    try {
      visible = await page.locator(`text=${EXPECT}`).first().isVisible().catch(() => false);
    } catch {
      console.log('[login] FAILED: window was closed before login completed');
      process.exit(2);
    }
    if (visible) { ok = true; break; }
  }

  if (!ok) {
    console.log('[login] FAILED: timed out. If you ARE logged in but on a different page,');
    console.log('[login] navigate the window to the target URL and re-run.');
    await ctx.close();
    process.exit(1);
  }

  await ctx.storageState({ path: AUTH_STATE });
  fs.chmodSync(AUTH_STATE, 0o600); // contains live session cookies — NEVER commit
  console.log('[login] SUCCESS: state saved to', AUTH_STATE, '(chmod 600)');
  console.log('[login] profile (cookies+localStorage+IndexedDB):', PROFILE_DIR);
  await ctx.close();
})().catch((e) => {
  console.error('[login] ERROR:', e.message);
  process.exit(3);
});
