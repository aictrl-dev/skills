// UX usability harness: one Playwright browser context per tester session, driven over local HTTP.
// Testers only see the page's accessibility tree (ariaSnapshot) and act by visible name, so the
// harness doubles as an accessible-name check.
//
// Run:   UX_TARGET=<file-or-url> node server.cjs      (needs Playwright with Chromium; see SKILL.md)
// Env:
//   UX_TARGET        file path or URL to open (required)
//   UX_PORT          harness port (default 3917). Clients must use the same UX_PORT.
//   UX_OUT           output directory for actions.jsonl and screenshots (default: a new temp dir outside
//                    the repository; the path is printed at start-up)
//   UX_VIEWPORT      default viewport as WIDTHxHEIGHT (default 1440x900); "open --viewport" overrides it
//   UX_HIDE_CSS      CSS injected on open to hide prototype chrome users would not see,
//                    e.g. '.dev-toolbar,.design-notes{display:none!important}'
//   UX_SCENARIO_SEL  selector of a <select> that jumps a prototype to a named state on "open <scenario>"
//   UX_SETUP         path to a .cjs module exporting async (page, ctx) => {} run after navigation
//                    (e.g. sign in to a test account)
//   UX_STORAGE_STATE Playwright storageState JSON for an already signed-in context
//
// Access control: every request needs the per-run token that the server writes to
// $TMPDIR/ux-harness-<uid>/<port>.token, inside a directory only this user can open (0700); ux.cjs
// reads it. The verify-only "eval" action needs a second token that is never written to disk: the
// server prints it once for the operator, who passes it to verify.cjs as UX_VERIFY_TOKEN. Requests
// carrying an Origin or Referer header (i.e. sent by a browser) and requests for another Host are rejected.
// Typed text is never written to the log (testers may type credentials).
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { loadPlaywright, tokenFile } = require('./common.cjs');

const { chromium } = loadPlaywright();
const PORT = Number(process.env.UX_PORT || 3917);
const TARGET = process.env.UX_TARGET;
if (!TARGET) {
  console.error('UX_TARGET is required (file path or URL)');
  process.exit(1);
}
const TARGET_URL = /^https?:\/\//.test(TARGET) ? TARGET : 'file://' + path.resolve(TARGET);
const OUT = process.env.UX_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'ux-run-'));
const LOG = path.join(OUT, 'actions.jsonl');
const SHOTS = path.join(OUT, 'shots');
const SETUP = process.env.UX_SETUP ? require(path.resolve(process.env.UX_SETUP)) : null;
const MAX_BODY = 1024 * 1024;
const ACTION_TIMEOUT_MS = 4000;
fs.mkdirSync(SHOTS, { recursive: true });

const MAX_SESSIONS = 32;
const uid = typeof process.getuid === 'function' ? process.getuid() : null;
// A private, per-user directory: a fixed name in the shared tmpdir could be pre-planted as a symlink.
const TOKEN_FILE = tokenFile(PORT);
const TOKEN_DIR = path.dirname(TOKEN_FILE);
fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
const dirStat = fs.lstatSync(TOKEN_DIR);
if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || (uid !== null && dirStat.uid !== uid) || (dirStat.mode & 0o077) !== 0) {
  console.error(`ERROR: ${TOKEN_DIR} must be a directory owned by you with mode 0700. Remove it and start again.`);
  process.exit(1);
}
const TOKEN = crypto.randomBytes(24).toString('hex');
const VERIFY_TOKEN = crypto.randomBytes(24).toString('hex');

// Constant-time comparison without leaking the length: compare fixed-size digests.
function tokenMatches(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

let DEFAULT_VIEWPORT = { width: 1440, height: 900 };
if (process.env.UX_VIEWPORT) {
  const m = /^(\d+)x(\d+)$/.exec(process.env.UX_VIEWPORT);
  if (!m) { console.error('UX_VIEWPORT must be WIDTHxHEIGHT, e.g. 1366x768'); process.exit(1); }
  DEFAULT_VIEWPORT = { width: Number(m[1]), height: Number(m[2]) };
}

let browser;
const sessions = new Map();

function validViewport(v) {
  if (!v) return null;
  const ok = (n) => Number.isInteger(n) && n >= 320 && n <= 3840;
  if (!ok(v.width) || !ok(v.height)) throw new Error('viewport must be WIDTHxHEIGHT between 320 and 3840');
  return { width: v.width, height: v.height };
}

async function open(id, scenario, viewport) {
  if (scenario && !process.env.UX_SCENARIO_SEL) throw new Error(`scenario "${scenario}" given but UX_SCENARIO_SEL is not configured`);
  if (!sessions.has(id) && sessions.size >= MAX_SESSIONS) throw new Error(`too many open sessions (${MAX_SESSIONS}); restart the harness between batches`);
  const ctx = await browser.newContext({
    viewport: validViewport(viewport) || validViewport(DEFAULT_VIEWPORT),
    ...(process.env.UX_STORAGE_STATE ? { storageState: process.env.UX_STORAGE_STATE } : {}),
  });
  ctx.setDefaultTimeout(ACTION_TIMEOUT_MS);
  const errors = [];
  let page;
  try {
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(TARGET_URL, { timeout: 30000 });
    if (SETUP) await SETUP(page, ctx);
    if (scenario) await page.selectOption(process.env.UX_SCENARIO_SEL, scenario);
    if (process.env.UX_HIDE_CSS) await page.addStyleTag({ content: process.env.UX_HIDE_CSS });
    await page.waitForTimeout(500);
  } catch (e) {
    await ctx.close().catch(() => {});
    throw e;
  }
  // Swap only after the new session is fully ready, then close the old one. The get and set run in
  // one synchronous step, so of two overlapping opens the later one always closes the earlier one.
  const previous = sessions.get(id);
  sessions.set(id, { ctx, page, errors });
  if (previous) await previous.ctx.close().catch(() => {});
  return 'Opened the app. Use "snapshot" to see the page.';
}

const ROLES = ['button', 'link', 'tab', 'option', 'menuitem', 'checkbox', 'radio', 'treeitem', 'row', 'combobox'];

// Returns { loc, note }, { error } for malformed input, or null when nothing matches.
// A trailing " #N" picks the Nth match, but only when the literal text (e.g. "Run #210") matches
// nothing, so names that end in a number stay clickable.
async function resolve(page, target) {
  const literal = await locate(page, target, 0);
  if (literal) return literal;
  const m = target.match(/^(.*?)\s+#(\d+)$/);
  if (!m) return null;
  const idx = Number(m[2]) - 1;
  if (idx < 0) return { error: 'ERROR: matches are numbered from #1.' };
  return locate(page, m[1], idx);
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What was actually clicked, so the tester and the log both see it.
async function nameOf(loc) {
  return loc
    .evaluate((el) => (el.getAttribute('aria-label') || (el.labels && el.labels[0] ? el.labels[0].innerText : '') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120))
    .catch(() => '');
}

async function locate(page, target, idx) {
  let role = null;
  let name = target.trim();
  const rm = name.match(/^(\w+):(.*)$/);
  if (rm && ROLES.includes(rm[1])) { role = rm[1]; name = rm[2].trim(); }
  if (!name) return { error: 'ERROR: click needs the visible name of what to click.' };
  const roles = role ? [role] : ROLES;
  const tries = [
    ...roles.map((r) => page.getByRole(r, { name, exact: true })),
    // Fuzzy fallback: the element's name must START with the text (never merely contain it), so
    // "run #210" cannot hit "Approve gate: … (run #210)". Accessible names start with the visible label.
    ...roles.map((r) => page.getByRole(r, { name: new RegExp('^\\s*' + escapeRe(name), 'i') })),
    ...(role ? [] : [page.getByText(name, { exact: true }), page.getByText(name)]),
  ];
  for (const loc of tries) {
    const vis = loc.filter({ visible: true });
    const count = await vis.count();
    if (count > 0) {
      const note = count > 1 ? ` (${count} matches; clicked #${Math.min(idx + 1, count)}. Add " #2" etc. to pick another.)` : '';
      return { loc: vis.nth(Math.min(idx, count - 1)), note };
    }
  }
  return null;
}

async function snapshot(page) {
  let snap = await page.locator('body').ariaSnapshot();
  if (snap.length > 14000) snap = snap.slice(0, 14000) + '\n… (truncated; narrow down by navigating)';
  return snap;
}

const HELP = 'Use snapshot, click, type, select, press, wait, screenshot.';

async function run(s, action, args) {
  const { page } = s;
  switch (action) {
    case 'snapshot':
      return snapshot(page);
    case 'click': {
      const r = await resolve(page, args.join(' '));
      if (!r) return `ERROR: nothing visible matches "${args.join(' ')}". Take a snapshot and use a name you can see.`;
      if (r.error) return r.error;
      await r.loc.scrollIntoViewIfNeeded().catch(() => {});
      const clicked = await nameOf(r.loc);
      await r.loc.click();
      await page.waitForTimeout(800);
      s.lastClicked = clicked;
      return `Clicked "${clicked}".` + r.note;
    }
    case 'select': {
      const [field, ...rest] = args;
      if (!field || rest.length === 0) return 'ERROR: select needs a quoted label and an option, e.g. select "Status" Ready';
      const boxes = page.getByRole('combobox', { name: field }).filter({ visible: true });
      const n = await boxes.count();
      await boxes.first().selectOption({ label: rest.join(' ') });
      await page.waitForTimeout(500);
      return 'Selected.' + (n > 1 ? ` (${n} fields named "${field}"; used the first.)` : '');
    }
    case 'type': {
      const words = [...args];
      let field = null;
      let enter = false;
      if (words[0] === '--field') {
        if (!words[1]) return 'ERROR: --field needs a quoted label, e.g. type --field "Title" New title';
        field = words[1];
        words.splice(0, 2);
      }
      if (words[words.length - 1] === '--enter') { enter = true; words.pop(); }
      if (!words.join(' ').trim()) return 'ERROR: type needs text, e.g. type Hello --enter or type --field "Title" New title';
      const named = field ? page.getByRole('textbox', { name: field }).filter({ visible: true }) : null;
      const n = named ? await named.count() : 0;
      const box = field
        ? named.first()
        : // The chat box is a textarea; only fall back to single-line inputs (e.g. a search field) when there is none.
          // Picking by DOM order breaks when the chat panel sits before the page content.
          ((await page.locator('textarea:visible').count())
            ? page.locator('textarea:visible').last()
            : page.locator('input[type="text"]:visible, input[type="search"]:visible, input:not([type]):visible').last());
      await box.fill(words.join(' '));
      if (enter) { await box.press('Enter'); await page.waitForTimeout(900); }
      return (enter ? 'Typed and sent.' : 'Typed.') + (n > 1 ? ` (${n} fields named "${field}"; used the first.)` : '');
    }
    case 'press':
      if (!args[0]) return 'ERROR: press needs a key, e.g. press Escape';
      await page.keyboard.press(args[0]);
      await page.waitForTimeout(500);
      return 'Pressed.';
    case 'wait': {
      if (args[0] !== undefined && !/^\d+$/.test(args[0])) return 'ERROR: wait needs milliseconds as a number, e.g. wait 3000';
      const ms = args[0] === undefined ? 1000 : Number(args[0]);
      await page.waitForTimeout(Math.min(ms, 8000));
      return 'Waited.';
    }
    case 'screenshot': {
      const f = path.join(SHOTS, `${Date.now()}.png`);
      await page.screenshot({ path: f });
      return f;
    }
    default:
      return `ERROR: unknown action "${action}". ${HELP}`;
  }
}

// Never persist typed text: it can contain credentials entered during sign-in.
function redactArgs(action, args) {
  if (action !== 'type' || !Array.isArray(args)) return args;
  const out = [];
  const words = [...args];
  if (words[0] === '--field') out.push('--field', words[1] ?? '');
  const enter = words[words.length - 1] === '--enter';
  out.push('<redacted>');
  if (enter) out.push('--enter');
  return out;
}

function logLine(entry) {
  const safe = { ...entry, args: redactArgs(entry.action, entry.args) };
  fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...safe }) + '\n');
}

function reply(res, status, text) {
  try {
    res.statusCode = status;
    res.end(String(text));
  } catch { /* client went away */ }
}

(async () => {
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(`ERROR: could not start Chromium (${String(e.message).split('\n')[0]}). Run \`npx playwright install chromium\`.`);
    process.exit(3);
  }
  const server = http.createServer((req, res) => {
    req.on('error', () => {}); // a client reset must not take down the harness
    const host = String(req.headers.host || '');
    if (req.headers.origin || req.headers.referer || (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`)) {
      reply(res, 403, 'ERROR: forbidden');
      req.resume();
      return;
    }
    if (!tokenMatches(req.headers['x-ux-token'], TOKEN)) {
      reply(res, 401, 'ERROR: missing or wrong harness token (run the client from the same machine as the server)');
      req.resume();
      return;
    }
    let body = '';
    let tooLarge = false;
    req.on('data', (c) => {
      if (tooLarge) return;
      body += c;
      if (body.length > MAX_BODY) {
        tooLarge = true;
        res.statusCode = 413;
        res.setHeader('Connection', 'close');
        res.end('ERROR: request too large', () => req.destroy()); // destroy only after the reply is flushed
      }
    });
    req.on('end', async () => {
      if (tooLarge) return;
      let out;
      let parsed = {};
      try {
        parsed = JSON.parse(body || '{}');
        const { session, action, args = [], scenario, expr, viewport } = parsed;
        if (typeof session !== 'string' || !/^[\w.-]{1,64}$/.test(session)) throw new Error('session must be 1-64 letters, digits, "_", "-" or "."');
        if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) throw new Error('args must be a list of strings');
        if (action === 'open') {
          out = await open(session, scenario, viewport);
        } else if (action === 'eval') {
          // Verification only: needs the separate verify token, never given to testers.
          if (!tokenMatches(req.headers['x-ux-verify-token'], VERIFY_TOKEN)) throw new Error('forbidden');
          const s = sessions.get(session);
          if (!s) throw new Error(`No session "${session}"`);
          const value = await s.page.evaluate(expr);
          // A check that returns nothing asserted nothing; never let it read as a pass.
          if (value === undefined) throw new Error('the check returned undefined; make the expression return a value');
          out = JSON.stringify(value);
        } else if (action === 'errors') {
          const s = sessions.get(session);
          if (!s) throw new Error(`No session "${session}"`);
          out = JSON.stringify(s.errors);
        } else {
          const s = sessions.get(session);
          if (!s) throw new Error('No session. Run "open" first.');
          s.lastClicked = undefined;
          out = await run(s, action, args);
          if (s.lastClicked !== undefined) parsed.clicked = s.lastClicked;
        }
        logLine({ session, action, args, ok: !String(out).startsWith('ERROR'), ...(parsed.clicked !== undefined ? { clicked: parsed.clicked } : {}) });
      } catch (e) {
        out = 'ERROR: ' + String(e.message).split('\n')[0];
        logLine({ session: parsed.session, action: parsed.action, args: parsed.args, ok: false, error: out });
      }
      reply(res, 200, out);
    });
  });
  server.on('clientError', (err, socket) => {
    try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { /* ignore */ }
  });
  // A failed bind (e.g. a harness already on this port) exits without touching that harness's token file.
  server.on('error', (e) => {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  });
  server.listen(PORT, '127.0.0.1', () => {
    fs.writeFileSync(TOKEN_FILE, TOKEN, { mode: 0o600 });
    process.on('exit', () => {
      try { fs.unlinkSync(TOKEN_FILE); } catch { /* already gone */ }
    });
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
    console.log(`ux harness on ${PORT} → ${TARGET_URL}\noutput: ${OUT}`);
    console.log(`verify token (operator only; pass to verify.cjs as UX_VERIFY_TOKEN, never to testers): ${VERIFY_TOKEN}`);
  });
})();
