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
//   UX_VERIFY_TOKEN  optional verify token of your choice (>= 32 chars); when set it is not printed
//
// Access control: every request needs the per-run token that the server writes to
// $TMPDIR/ux-harness-<uid>/<port>.token, inside a directory only this user can open (0700); ux.cjs
// reads it. The verify-only "eval" action needs a second token that the harness never writes to disk: set it
// yourself as UX_VERIFY_TOKEN (>= 32 chars) in the server's environment, or the server generates one and prints
// it once (then any captured stdout holds a copy). Pass the same value to verify.cjs as UX_VERIFY_TOKEN.
// Operator-only actions need the verify token too: eval, close, errors, open with a scenario or viewport, and
// re-opening a live session id. Both tokens keep tester agents, which are only given ux.cjs, to the tester commands; they are not a defence
// against other processes running as your user. Requests carrying an Origin or Referer header (i.e. sent by a
// browser) and requests for another Host are rejected.
// Typed text is never written to the log (testers may type credentials).
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { loadPlaywright, tokenFile, resolveTarget: resolve } = require('./common.cjs');

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
// The operator may choose the verify token (UX_VERIFY_TOKEN in the server's environment), so it is never printed.
// Otherwise one is generated and printed once; anything that captures the server's stdout then holds a copy.
const VERIFY_TOKEN_GIVEN = Boolean(process.env.UX_VERIFY_TOKEN);
if (VERIFY_TOKEN_GIVEN && process.env.UX_VERIFY_TOKEN.length < 32) {
  console.error('UX_VERIFY_TOKEN must be at least 32 characters (e.g. 24 random bytes as hex).');
  process.exit(1);
}
const VERIFY_TOKEN = VERIFY_TOKEN_GIVEN ? process.env.UX_VERIFY_TOKEN : crypto.randomBytes(24).toString('hex');

// Constant-time comparison without leaking the length: compare fixed-size digests.
function tokenMatches(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function validViewport(v) {
  if (!v) return null;
  const ok = (n) => Number.isInteger(n) && n >= 320 && n <= 3840;
  if (!ok(v.width) || !ok(v.height)) throw new Error('viewport must be WIDTHxHEIGHT between 320 and 3840');
  return { width: v.width, height: v.height };
}

let DEFAULT_VIEWPORT = { width: 1440, height: 900 };
if (process.env.UX_VIEWPORT) {
  const m = /^(\d+)x(\d+)$/.exec(process.env.UX_VIEWPORT);
  try {
    if (!m) throw new Error();
    DEFAULT_VIEWPORT = validViewport({ width: Number(m[1]), height: Number(m[2]) });
  } catch {
    console.error('UX_VIEWPORT must be WIDTHxHEIGHT between 320 and 3840, e.g. 1366x768');
    process.exit(1);
  }
}

let browser;
const sessions = new Map(); // live sessions only: an entry is removed when its browser context closes
let opening = 0; // new session ids whose open is in flight, counted against MAX_SESSIONS

async function open(id, scenario, viewport) {
  if (scenario && !process.env.UX_SCENARIO_SEL) throw new Error(`scenario "${scenario}" given but UX_SCENARIO_SEL is not configured`);
  const vp = validViewport(viewport) || DEFAULT_VIEWPORT;
  // Reserve the slot synchronously, so concurrent opens of new ids cannot pass the check together.
  const isNew = !sessions.has(id);
  if (isNew && sessions.size + opening >= MAX_SESSIONS) throw new Error(`too many open sessions (${MAX_SESSIONS}); close finished sessions ("close") or restart the harness between batches`);
  if (isNew) opening++;
  let ctx;
  try {
    ctx = await browser.newContext({
      viewport: vp,
      ...(process.env.UX_STORAGE_STATE ? { storageState: process.env.UX_STORAGE_STATE } : {}),
    });
  } catch (e) {
    if (isNew) opening--;
    throw e;
  }
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
    if (isNew) opening--;
    await ctx.close().catch(() => {});
    throw e;
  }
  if (isNew) opening--;
  // Swap only after the new session is fully ready, then close the old one. The get and set run in
  // one synchronous step, so of two overlapping opens the later one always closes the earlier one.
  const previous = sessions.get(id);
  const entry = { ctx, page, errors };
  sessions.set(id, entry);
  // Free the slot when this context goes away (closed, replaced, or the browser crashed).
  ctx.on('close', () => { if (sessions.get(id) === entry) sessions.delete(id); });
  if (previous) await previous.ctx.close().catch(() => {});
  return 'Opened the app. Use "snapshot" to see the page.';
}

// What was actually clicked, so the tester and the log both see it.
async function nameOf(loc) {
  return loc
    .evaluate((el) => (el.getAttribute('aria-label') || (el.labels && el.labels[0] ? el.labels[0].innerText : '') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120))
    .catch(() => '');
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
      if (!n) return `ERROR: nothing visible matches field "${field}". Take a snapshot and use a label you can see.`;
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
      if (field && !n) return `ERROR: nothing visible matches field "${field}". Take a snapshot and use a label you can see.`;
      // The chat box is a textarea; only fall back to single-line inputs (e.g. a search field) when there is none.
      // Picking by DOM order breaks when the chat panel sits before the page content.
      const inputs = page.locator('input[type="text"]:visible, input[type="search"]:visible, input:not([type]):visible');
      const box = field
        ? named.first()
        : ((await page.locator('textarea:visible').count()) ? page.locator('textarea:visible').last() : inputs.last());
      if (!field && !(await box.count())) return 'ERROR: there is no visible text box. Use type --field "<label>" with a label you can see.';
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
// Only actions whose arguments are never secret are logged verbatim; "type" keeps its --field label and --enter
// flag; anything else (an unknown or misspelled action, e.g. "type " or "Type") is fully redacted.
const LOGGED_ARGS = new Set(['snapshot', 'click', 'select', 'press', 'wait', 'screenshot', 'open', 'close', 'errors', 'eval']);
function redactArgs(action, args) {
  if (!Array.isArray(args) || args.length === 0) return args;
  if (typeof action === 'string' && LOGGED_ARGS.has(action)) return args;
  if (typeof action !== 'string' || action.trim().toLowerCase() !== 'type') return ['<redacted>'];
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
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { parsed = {}; throw new Error('request must be a JSON object'); }
        const { session, action, args = [], scenario, expr, viewport } = parsed;
        // Operator-only actions (eval, close, errors, open with a scenario or viewport, re-opening a live session)
        // need the verify token, which tester agents never get; they share only the harness token.
        const operator = tokenMatches(req.headers['x-ux-verify-token'], VERIFY_TOKEN);
        const needOperator = (what) => { if (!operator) throw new Error(`${what} is operator-only (needs UX_VERIFY_TOKEN)`); };
        if (typeof session !== 'string' || !/^[\w.-]{1,64}$/.test(session)) throw new Error('session must be 1-64 letters, digits, "_", "-" or "."');
        if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) throw new Error('args must be a list of strings');
        if (scenario !== undefined && typeof scenario !== 'string') throw new Error('scenario must be a string');
        if (expr !== undefined && typeof expr !== 'string') throw new Error('expr must be a string');
        if (typeof action !== 'string') throw new Error('action must be a string');
        const extra = {};
        if (action === 'open') {
          if (scenario || viewport) needOperator('open with a scenario or viewport');
          if (sessions.has(session) && !operator) throw new Error(`session "${session}" is already open: use snapshot, or pick a new session id`);
          if (scenario) extra.scenario = scenario;
          if (viewport) extra.viewport = viewport;
          out = await open(session, scenario, viewport);
        } else if (action === 'eval') {
          // Verification only: needs the separate verify token, never given to testers.
          if (!operator) throw new Error('forbidden');
          const s = sessions.get(session);
          if (!s) throw new Error(`No session "${session}"`);
          if (!expr) throw new Error('eval needs an expression');
          const value = await s.page.evaluate(expr);
          // A check that returns nothing asserted nothing; never let it read as a pass.
          if (value === undefined) throw new Error('the check returned undefined; make the expression return a value');
          out = JSON.stringify(value);
          extra.expr = expr.slice(0, 500);
          extra.result = out.slice(0, 2000);
        } else if (action === 'close') {
          // Operator: close a finished session and free its slot.
          needOperator('close');
          const s = sessions.get(session);
          if (!s) throw new Error(`No session "${session}"`);
          sessions.delete(session);
          await s.ctx.close().catch(() => {});
          out = 'Closed.';
        } else if (action === 'errors') {
          needOperator('errors');
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
        logLine({ session, action, args, ok: !String(out).startsWith('ERROR'), ...extra, ...(parsed.clicked !== undefined ? { clicked: parsed.clicked } : {}) });
      } catch (e) {
        out = 'ERROR: ' + String(e.message).split('\n')[0];
        // Keep the keys even for a malformed request, so every row can be attributed.
        const str = (v, dflt) => (typeof v === 'string' ? v.slice(0, 64) : dflt);
        logLine({ session: str(parsed.session, '(malformed)'), action: str(parsed.action, '(unknown)'), args: Array.isArray(parsed.args) ? parsed.args : [], ok: false, error: out });
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
    // Never follow a link planted at the token path: remove any stale file we own, then create exclusively.
    try {
      const st = fs.lstatSync(TOKEN_FILE);
      if (!st.isFile() || (uid !== null && st.uid !== uid)) {
        console.error(`ERROR: ${TOKEN_FILE} exists and is not a regular file you own. Remove it and start again.`);
        process.exit(1);
      }
      fs.unlinkSync(TOKEN_FILE); // left by a harness that was killed before it could clean up
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    const fd = fs.openSync(TOKEN_FILE, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
    fs.writeSync(fd, TOKEN);
    fs.closeSync(fd);
    process.on('exit', () => {
      try { fs.unlinkSync(TOKEN_FILE); } catch { /* already gone */ }
    });
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
    console.log(`ux harness on ${PORT} → ${TARGET_URL}\noutput: ${OUT}`);
    if (VERIFY_TOKEN_GIVEN) console.log('verify token: the UX_VERIFY_TOKEN you set (not printed)');
    else console.log(`verify token (operator only; pass to verify.cjs as UX_VERIFY_TOKEN, never to testers; set UX_VERIFY_TOKEN yourself to keep it out of captured output): ${VERIFY_TOKEN}`);
  });
})();
