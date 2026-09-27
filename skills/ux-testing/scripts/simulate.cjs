// Simulated first-time users ("System One"): fast, cheap usability estimates before running agent testers.
//
// Each simulated user walks one path through the page: code perceives the screen, a System One model judges
// what this user would do next (probabilities over the visible controls), one action is sampled from those
// probabilities, and the page is checked after every step against the task model's `success` and `must_not`
// expressions.
//
// Usage (needs Playwright with Chromium; js-yaml for a YAML task model):
//   node simulate.cjs --config sim.config.json [--tasks T1,T3] [--n 16] [--no-load]    # score tasks
//   node simulate.cjs --config sim.config.json --hyp H1.json [--n 16]                   # A/B hypothesis
// Options: --out <dir> (default: a new temp dir), --cache <file> (default: <out>/.sim-cache.json with --out, else a
// per-config file under ~/.cache/ux-sim, so re-runs stay cached), --workers <n>, --seed <n> (same seed and a warm
// cache repeat a run exactly, for any --workers).
//
// Needs a simulator backend: TYPESAFE_API_KEY (TypeSafe Jev), or UX_SIM_ENDPOINT + UX_SIM_API_KEY +
// UX_SIM_MODEL for a compatible endpoint. Without one it exits with code 2 and says how to set one up.
// Keys are read from the environment only and never logged or written.
// See reference/simulator.md for the config, the request/response contract, conditions and limits.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { loadPlaywright, loadModel, requireSimBackend, options, rng, seedOf } = require('./common.cjs');

const args = process.argv.slice(2);
const O = options(args);
const opt = O.str;
const flag = O.has;
const N = O.int('n', 16, 1);
const WORKERS = O.int('workers', 4, 1);
const SEED = O.int('seed', 42, 0);
if (!opt('config')) { console.error('Usage: node simulate.cjs --config sim.config.json [--tasks T1,T3] [--hyp H.json] [--n 16] [--out dir]'); process.exit(2); }

const BACKEND = requireSimBackend(); // exits with the not-configured message when there is no backend
const { chromium } = loadPlaywright();

const CONFIG_PATH = path.resolve(opt('config'));
const CONFIG_DIR = path.dirname(CONFIG_PATH);
const CFG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
// Relative paths in the config resolve against the config's directory; in a hypothesis file, against its own.
const fileUrl = (p, base = CONFIG_DIR) => (/^(https?|file):/.test(p) ? p : `file://${path.resolve(base, p)}`);
const MODEL = loadModel(path.resolve(CONFIG_DIR, CFG.model));
const TASKS = Object.fromEntries(MODEL.tasks.map((t) => [t.id, t]));
// The page's state hook: named by the config or the model, else window.__state, falling back to window.__mock
// (the name older task models used) so they keep working without a state_hook.
const STATE_HOOK = CFG.stateHook || (MODEL.meta && MODEL.meta.state_hook) || null;
// "needs-mock" is the older spelling of "needs-target"; both are skipped.
const SKIPPED = new Set(['needs-target', 'needs-mock']);
const oldStatus = MODEL.tasks.filter((t) => t.status === 'needs-mock').map((t) => t.id);
if (oldStatus.length) console.warn(`note: ${oldStatus.join(', ')} ${oldStatus.length > 1 ? 'still say' : 'still says'} "status: needs-mock"; skipped as needs-target (the new name).`);
const observedPath = CFG.observed && path.resolve(CONFIG_DIR, CFG.observed);
const OBSERVED = observedPath && fs.existsSync(observedPath) ? JSON.parse(fs.readFileSync(observedPath, 'utf8')) : {};
const OUT = path.resolve(opt('out') || fs.mkdtempSync(path.join(os.tmpdir(), 'ux-sim-')));
fs.mkdirSync(OUT, { recursive: true });

const MAX_STEPS = 16; // a path longer than this counts as a failure ("too-long")
const MAX_CHATS = 3; // a user who types into the chat more than this gives up
const MAX_ERROR_SHARE = 0.1; // a run whose walks end in harness errors more often than this (and more than once) stops, unscored
const STOP_MIN = 0.3; // a user only considers stopping when the model's stop probability reaches this
const SETTLE_MS = 1100;
const LAPTOP = { width: 1366, height: 768 };
const DESKTOP = { width: 1440, height: 900 };
// A chat region is marked with data-ux-chat; a plain <aside> (the older default) still counts.
const REGIONS = { main: 'main', chat: '[data-ux-chat], aside', menu: 'nav', topbar: 'header', ...(CFG.regions || {}) };
// Text boxes inside the chat region; each selector in a region list is scoped on its own.
const chatBoxes = (page, extra = '') => page.locator(REGIONS.chat).locator(`textarea${extra}`);
const HIDE = CFG.hideCss || '';
const HIDE_SEL = HIDE ? HIDE.split('{')[0] : '';

// Answers depend only on what the user sees, so they are cached per screen (and per backend); re-runs cost nothing.
// The cache holds screen text and probabilities, never keys. Without --cache or --out it lives outside the repo,
// one file per config, so a re-run of the same config stays free even though each run writes to a new temp dir.
const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
const CACHE_F = path.resolve(opt('cache') || (opt('out')
  ? path.join(OUT, '.sim-cache.json')
  : path.join(cacheHome, 'ux-sim', `${crypto.createHash('sha256').update(CONFIG_PATH).digest('hex').slice(0, 16)}.json`)));
fs.mkdirSync(path.dirname(CACHE_F), { recursive: true });
const cache = fs.existsSync(CACHE_F) ? JSON.parse(fs.readFileSync(CACHE_F, 'utf8')) : {};
let calls = 0; let dirty = 0;
const saveCache = () => { if (dirty) { fs.writeFileSync(CACHE_F, JSON.stringify(cache)); dirty = 0; } };

// Every walk gets its own generator, seeded from --seed and the walk's identity (case, profile, condition,
// run index), so a re-run with the same --seed and a warm cache repeats exactly, whatever the worker count.
// Probabilities may sum to 1 ± 0.02 (the contract's tolerance); renormalise so no leftover mass falls on one option.
const sample = (rnd, dist) => {
  const total = dist.reduce((t, [, v]) => t + v, 0);
  const r = rnd() * total; let acc = 0;
  for (const [k, v] of dist) { acc += v; if (r < acc) return k; }
  return dist.find(([, v]) => v > 0)[0]; // floating-point edge: the most likely option, never the least
};

const SEL = 'button, a[href], [role="button"], [role="tab"], input[type="radio"], input[type="checkbox"], summary, select';

// Perception is code, not the model. A "scanner" sees only what is on screen without scrolling (the 14 most
// prominent page controls, icons as symbols); a "reader" gets every control's accessible name and all page text.
async function perceive(page, profile) {
  // Each perceived control is tagged with this screen's generation, so act() clicks exactly that element, or
  // fails with "control gone" if a re-render replaced it, instead of clicking whatever now sits at its index.
  const gen = crypto.randomBytes(4).toString('hex');
  const g = await page.evaluate(({ profile, SEL, R, HIDE_SEL, ROW, ROW_TITLE, gen }) => {
    const vh = innerHeight;
    const hidden = (el) => HIDE_SEL && el.closest(HIDE_SEL);
    const within = (el, sel) => { try { return sel && el.closest(sel); } catch { return false; } };
    const regionOf = (el) => (within(el, R.menu) ? 'menu' : within(el, R.chat) ? 'chat' : within(el, R.topbar) ? 'topbar' : within(el, R.main) ? 'main' : 'side');
    const mainEl = document.querySelector(R.main) || document.body;
    const mainBox = mainEl.getBoundingClientRect();
    const els = [...document.querySelectorAll(SEL)].filter((el) => !hidden(el));
    const out = []; let below = 0; let above = 0;
    els.forEach((el, idx) => {
      el.setAttribute('data-ux-sim', `${gen}:${idx}`);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') return;
      const reg = regionOf(el);
      if (profile === 'scanner') {
        // The fold: the viewport, or the main region's own box when it scrolls inside a fixed layout.
        const inPage = reg === 'main' || reg === 'side';
        const box = reg === 'main' ? mainBox : { top: 0, bottom: vh };
        if (r.top >= Math.min(vh, box.bottom) - 4) { if (inPage) below++; return; }
        if (r.bottom <= Math.max(0, box.top)) { if (inPage) above++; return; }
      }
      const lbl = el.labels && el.labels[0] ? el.labels[0].innerText : '';
      const raw = (el.tagName === 'INPUT' ? lbl : el.tagName === 'SELECT' ? `${lbl} ${(el.selectedOptions[0] || {}).text || ''}` : el.innerText || '').trim().replace(/\s+/g, ' ');
      const aria = (el.getAttribute('aria-label') || raw).trim().replace(/\s+/g, ' ');
      const icon = !/[\p{L}\p{N}]/u.test(raw);
      const host = ROW ? el.closest(ROW) : null;
      const hostTitle = host && ROW_TITLE ? ((host.querySelector(ROW_TITLE) || {}).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50) : '';
      const cls = typeof el.className === 'string' ? el.className : '';
      const role = el.getAttribute('role');
      const style = /\b(primary|cta)\b|-primary\b/i.test(cls) ? 'primary button'
        : /\b(danger|destructive)\b|-danger\b/i.test(cls) ? 'red button'
        : el.tagName === 'BUTTON' || role === 'button' || /\bbtn\b/.test(cls) ? 'button'
        : role === 'tab' ? 'tab'
        : el.type === 'radio' ? 'radio option' : el.type === 'checkbox' ? 'checkbox'
        : el.tagName === 'SELECT' ? 'dropdown' : el.tagName === 'A' ? 'link' : 'clickable text';
      // visual weight: area × emphasis, discounted the further down the screen it sits
      const emphasis = { 'primary button': 3, 'red button': 2, button: 1.6, tab: 1.4, 'radio option': 1.4, checkbox: 1.2, dropdown: 1.2, link: 1, 'clickable text': 0.9 }[style];
      const weight = (r.width * r.height) * emphasis / (1 + Math.max(0, r.top) / vh);
      const label = profile === 'reader' ? (aria || '(unnamed control)') : icon ? `(icon ${raw || 'symbol'}, no label)` : raw;
      out.push({ idx, reg, label: label.slice(0, 90), style, hostTitle, weight, top: Math.round(r.top) });
    });
    let controls;
    if (profile === 'scanner') {
      const main = out.filter((c) => c.reg === 'main' || c.reg === 'side').sort((a, b) => b.weight - a.weight).slice(0, 14).sort((a, b) => a.top - b.top);
      controls = [...main, ...out.filter((c) => c.reg !== 'main' && c.reg !== 'side')];
    } else controls = out.slice(0, 120);
    let text = '';
    if (profile === 'reader') text = document.body.innerText.replace(/\s+/g, ' ').slice(0, 3000);
    else {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode() && text.length < 1600) {
        const n = w.currentNode; const s = n.textContent.trim(); if (!s) continue;
        const p = n.parentElement; if (!p || hidden(p) || p.closest('script,style,noscript')) continue;
        const r = p.getBoundingClientRect(); if (r.height === 0 || r.bottom < 0 || r.top > vh) continue;
        text += s + ' | ';
      }
    }
    const chatEl = R.chat ? document.querySelector(R.chat) : null;
    const chat = chatEl ? chatEl.innerText.replace(/\s+/g, ' ').slice(-900) : '';
    return { controls, below, above, text, chat };
  }, { profile, SEL, R: REGIONS, HIDE_SEL, ROW: CFG.rowSelector || '', ROW_TITLE: CFG.rowTitleSelector || '', gen });
  g.gen = gen;
  return g;
}

async function judge(task, g, profile, cond, step) {
  const facts = task.answer || [];
  const criteria = {};
  g.controls.forEach((c, i) => { criteria['c' + i] = `${c.style} ${c.label.startsWith('(icon') ? c.label : `"${c.label}"`}${c.hostTitle && !c.label.includes(c.hostTitle) ? ` on "${c.hostTitle}"` : ''} (${c.reg === 'main' || c.reg === 'side' ? 'page' : c.reg})`; });
  if (g.below) criteria.__scroll_down = `Scroll the page down to see more (${g.below} more controls below, not visible yet)`;
  if (g.above) criteria.__scroll_up = 'Scroll the page back up';
  criteria.__wait = 'Wait a few seconds for something that is in progress to update';
  if (g.hasChat) criteria.__type_chat = 'Type a question or request into the chat box';
  criteria.__give_up = 'Give up: nothing here seems to lead to the goal';
  const user = profile === 'scanner'
    ? 'A busy first-time user of this web app. They glance at the screen and act on the first control that seems to lead to their goal; they do not read everything.'
    : 'A careful first-time user of this web app who reads the whole page before acting.';
  const interrupted = cond === 'interrupt' && step >= 2;
  const goal = cond === 'paraphrase' ? (task.paraphrase || task.prompt) : task.prompt;
  const state = {
    user: interrupted ? `${user} They were interrupted and are coming back to this screen, remembering only their goal.` : user,
    task: goal,
    screen: { [profile === 'scanner' ? 'readable_now' : 'page_text']: g.text, chat_panel: interrupted ? '' : g.chat },
  };
  const questions = {
    next: { type: 'choice', instructions: 'Which one thing would this user do next to make progress on the `task`, judging only from what they can see on the `screen`?', criteria },
    believes_done: { type: 'noul', instructions: 'Looking at the `screen`, would this user believe their `task` is already complete and stop here?', criteria: { true: 'The screen looks like the task has been done', false: 'The task clearly still needs action' } },
    can_answer: { type: 'noul', instructions: 'Can the user answer the question in the `task` from what is readable on the `screen` right now?' },
  };
  if (facts.length) questions.answer_correct = { type: 'noul', instructions: { expected_answer_contains: facts, question: 'If the user answered the `task` from what is readable on the `screen`, would their answer contain the information in `expected_answer_contains` (different wording is fine)?' } };
  // Hash the full questions: their instructions carry the task's answer facts, so editing them re-asks.
  const k = crypto.createHash('sha1').update(JSON.stringify([BACKEND.endpoint, BACKEND.model, state, questions])).digest('hex');
  if (cache[k]) return cache[k];
  const j = await BACKEND.ask(state, questions);
  calls++;
  const out = { next: j.answers.next.probabilities, done: j.answers.believes_done.noul, answer: j.answers.can_answer.noul, correct: j.answers.answer_correct ? j.answers.answer_correct.noul : null };
  cache[k] = out; dirty++; if (dirty > 20) saveCache();
  return out;
}

async function act(page, g, a, prompt) {
  if (a === '__scroll_down' || a === '__scroll_up') {
    await page.evaluate(({ d, main }) => {
      const m = document.querySelector(main);
      const scroller = m && m.scrollHeight > m.clientHeight + 4 && getComputedStyle(m).overflowY !== 'visible' ? m : document.scrollingElement;
      scroller.scrollBy(0, d * Math.min(scroller.clientHeight, innerHeight) * 0.75);
    }, { d: a === '__scroll_down' ? 1 : -1, main: REGIONS.main });
    await page.waitForTimeout(250); return;
  }
  if (a === '__wait') { await page.waitForTimeout(3500); return; }
  if (a === '__type_chat') {
    // A user who turns to chat asks for the goal in their own words; the task text stands in for that.
    const box = chatBoxes(page, ':visible').last();
    await box.fill(prompt, { timeout: 5000 }); await box.press('Enter'); await page.waitForTimeout(SETTLE_MS + 600); return;
  }
  const c = g.controls[Number(a.slice(1))];
  await page.evaluate(({ tag }) => {
    const el = document.querySelector(`[data-ux-sim="${tag}"]`);
    if (!el) throw new Error('control gone');
    if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click();
  }, { tag: `${g.gen}:${c.idx}` });
  await page.waitForTimeout(SETTLE_MS);
}

// Evaluates the task model's own success / must_not expressions in the page. `S` is the page's read-only
// state hook (window[stateHook]; without one, window.__state, else window.__mock) when it has one; expressions
// may also query the DOM.
// Test harness only: the expressions come from the author's own task model file.
// An expression that throws is a broken check, not a failed user: the run stops and names it, like verify.cjs.
async function check(page, task) {
  const r = await page.evaluate(([s, n, meta, hook]) => {
    const S = hook ? window[hook] : (window.__state !== undefined ? window.__state : window.__mock); const META = meta; // eslint-disable-line no-unused-vars
    const ev = (e) => { if (!e) return { v: null }; try { return { v: !!eval(e) }; } catch (x) { return { err: String(x && x.message || x) }; } }; // eslint-disable-line no-eval
    return { success: ev(s), harm: ev(n) };
  }, [task.success, task.must_not, MODEL.meta || {}, STATE_HOOK]);
  for (const [field, key] of [['success', 'success'], ['must_not', 'harm']]) {
    if (r[key].err) throw new CheckError(`task ${task.id}: ${field} expression threw "${r[key].err}" (${task[field]}). Make it return true or false in every page state.`);
  }
  return { success: r.success.v, harm: r.harm.v };
}

class CheckError extends Error {}
class RunError extends Error {}

function viewportFor(task, cond) {
  if (cond === 'laptop') return LAPTOP;
  const v = task.start && task.start.viewport;
  return v ? { width: v[0], height: v[1] } : DESKTOP;
}

async function walkOne(browser, c, task, profile, cond, rnd) {
  const page = await browser.newPage({ viewport: viewportFor(task, cond) });
  try {
    await page.goto(c.url);
    const scenario = c.scenario || (task.start && task.start.scenario);
    if (CFG.scenarioSelect && scenario && scenario !== 'cold') await page.selectOption(CFG.scenarioSelect, scenario);
    if (HIDE) await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout((CFG.slowScenarios || {})[scenario] || 500);
    if (c.mutate) await page.evaluate(c.mutate);
    const hasChat = (await chatBoxes(page).count()) > 0;
    const isQuestion = !task.success;
    let chats = 0; const trail = [];
    for (let step = 0; step <= MAX_STEPS; step++) {
      if (c.mutate) await page.evaluate(c.mutate); // re-apply after re-renders
      const st = await check(page, task);
      if (st.harm) return { end: 'harm', steps: step, trail };
      if (!isQuestion && st.success) return { end: 'success', steps: step, trail };
      if (step === MAX_STEPS) return { end: 'too-long', steps: step, trail };
      const g = await perceive(page, profile); g.hasChat = hasChat;
      const J = await judge(task, g, profile, cond, step);
      const stopP = isQuestion ? J.answer : J.done;
      if (stopP >= STOP_MIN && rnd() < stopP) {
        if (!isQuestion) return { end: 'premature-stop', steps: step, trail };
        const right = rnd() < J.correct; // question tasks always have answer facts (checked at start-up)
        return { end: right ? 'success' : 'wrong-answer', steps: step, trail };
      }
      const a = sample(rnd, Object.entries(J.next).sort((x, y) => y[1] - x[1]));
      if (a === '__give_up') return { end: 'give-up', steps: step, trail };
      if (a === '__type_chat' && ++chats > MAX_CHATS) return { end: 'give-up', steps: step, trail };
      trail.push(a.startsWith('__') ? a.slice(2) : g.controls[Number(a.slice(1))].label.slice(0, 40));
      await act(page, g, a, task.prompt);
    }
  } catch (e) {
    // A backend failure or a broken check is not a usability result: stop the run rather than score it.
    if (e instanceof CheckError) throw e;
    if (/^simulator /.test(e.message)) throw new RunError(`task ${task.id}: a walk failed from a simulator backend error (${e.message}). Nothing from this run is scored; check the backend and run again.`);
    // Any other failure (page crash, navigation, a control replaced mid-click) is the harness's, not the user's:
    // it ends as `error`, which run() leaves out of success and harm and reports separately.
    return { end: 'error', steps: 0, trail: [String(e.message).split('\n')[0].slice(0, 120)] };
  } finally { await page.close().catch(() => {}); }
}

// A task needs a success check, or (a question task) the facts its answer must contain; otherwise every walk
// would "succeed" with nothing checked.
function assertGradeable(ids) {
  for (const id of ids) {
    const t = TASKS[id];
    if (!t) throw new Error(`Task ${id} is not in the model`);
    if (!t.success && !(Array.isArray(t.answer) && t.answer.length)) throw new Error(`Task ${id} has neither a success check nor answer facts, so it cannot be graded. Add \`success\` or \`answer: [...]\`.`);
  }
}

async function run(browser, c, profile, cond = 'focused') {
  const task = TASKS[c.task];
  if (!task) throw new Error(`Task ${c.task} is not in the model`);
  const results = new Array(N); let started = 0;
  const worker = async () => {
    while (started < N) {
      const i = started++;
      results[i] = await walkOne(browser, c, task, profile, cond, rng(seedOf(SEED, c.id, c.url, c.mutate || '', profile, cond, i)));
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, N) }, worker));
  saveCache();
  // Walks that ended in a harness error say nothing about the user: they are left out of success, harm and the
  // bootstrap, and counted in `errors`. Too many of them and the run is not trustworthy, so it stops. One error
  // is tolerated at any N (so a small smoke run survives one transient failure), unless no walk was scored.
  const errors = results.filter((r) => r.end === 'error');
  if (errors.length === N || errors.length > Math.max(1, N * MAX_ERROR_SHARE)) {
    throw new RunError(`task ${task.id} (${profile}, ${cond}): ${errors.length} of ${N} walks failed from harness errors (the limit is one, or ${MAX_ERROR_SHARE * 100}% of the walks), e.g. "${errors[0].trail[0]}". Nothing from this run is scored; fix the page or the config and run again.`);
  }
  const scored = results.filter((r) => r.end !== 'error');
  const count = (e) => scored.filter((r) => r.end === e).length;
  const ok = scored.filter((r) => r.end === 'success');
  const ends = {}; results.forEach((r) => { ends[r.end] = (ends[r.end] || 0) + 1; });
  const fails = {}; scored.filter((r) => r.end !== 'success').forEach((r) => { const k = `${r.end}: ${r.trail.slice(0, 4).join(' → ') || '(start)'}`; fails[k] = (fails[k] || 0) + 1; });
  return {
    raw: scored.map((r) => ({ ok: r.end === 'success' ? 1 : 0, harm: r.end === 'harm' ? 1 : 0, steps: r.steps })),
    n: scored.length,
    errors: errors.length,
    success: +(count('success') / scored.length).toFixed(2),
    harm: +(count('harm') / scored.length).toFixed(2),
    steps: ok.length ? +(ok.reduce((s, r) => s + r.steps, 0) / ok.length).toFixed(1) : null,
    ends,
    topFail: Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([k, v]) => `${v}× ${k}`)[0] || '',
  };
}

// 90% bootstrap interval for the difference B − A.
function boot(a, b, key, iters = 2000) {
  const rnd = rng(seedOf(SEED, 'bootstrap', key, a.length, b.length));
  const mean = (xs) => xs.reduce((s, x) => s + x[key], 0) / xs.length; const ds = [];
  for (let i = 0; i < iters; i++) {
    const ra = a.map(() => a[Math.floor(rnd() * a.length)]); const rb = b.map(() => b[Math.floor(rnd() * b.length)]);
    ds.push(mean(rb) - mean(ra));
  }
  ds.sort((x, y) => x - y);
  return { delta: +(mean(b) - mean(a)).toFixed(2), lo: +ds[Math.floor(iters * 0.05)].toFixed(2), hi: +ds[Math.floor(iters * 0.95)].toFixed(2) };
}

async function hypothesis(browser, H, hypDir) {
  assertGradeable(H.tasks);
  const rows = [];
  // Written after every row, so a later failure keeps the rows already computed.
  const file = path.join(OUT, `hyp-${H.id}.json`);
  const save = (extra) => fs.writeFileSync(file, JSON.stringify({ H, n: N, rows, ...extra }, null, 2));
  const variant = (v, tid) => ({ id: tid, task: tid, url: v && v.url ? fileUrl(v.url, hypDir) : fileUrl(CFG.url), mutate: v && v.mutate });
  const stepsOf = (R) => { const ok = R.raw.filter((r) => r.ok); return ok.length ? +(ok.reduce((t, r) => t + r.steps, 0) / ok.length).toFixed(1) : null; };
  const verdict = (x) => (x.lo > 0 ? 'B higher' : x.hi < 0 ? 'B lower' : 'no clear difference');
  for (const tid of H.tasks) {
    for (const cond of H.conds || ['focused']) {
      const A = await run(browser, variant(H.a, tid), 'scanner', cond);
      const B = await run(browser, variant(H.b, tid), 'scanner', cond);
      const s = boot(A.raw, B.raw, 'ok'); const h = boot(A.raw, B.raw, 'harm');
      const row = { task: tid, cond, A: A.success, B: B.success, nA: A.n, nB: B.n, errorsA: A.errors, errorsB: B.errors, stepsA: stepsOf(A), stepsB: stepsOf(B), success: { ...s, verdict: verdict(s) }, harmA: A.harm, harmB: B.harm, harm: { ...h, verdict: verdict(h) }, failA: A.topFail, failB: B.topFail };
      rows.push(row); console.log(JSON.stringify(row)); save();
    }
  }
  return { rows, file };
}

(async () => {
  console.log(`simulator: ${BACKEND.label} · output ${OUT} · cache ${CACHE_F}`);
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(`ERROR: could not start Chromium (${String(e.message).split('\n')[0]}). Run \`npx playwright install chromium\`.`);
    process.exit(3);
  }
  try {
    if (opt('hyp')) {
      const hypPath = path.resolve(opt('hyp'));
      const H = JSON.parse(fs.readFileSync(hypPath, 'utf8'));
      const { file } = await hypothesis(browser, H, path.dirname(hypPath));
      console.log(`wrote ${file} · model calls ${calls}`);
      return;
    }
    const only = opt('tasks') ? opt('tasks').split(',') : null;
    const cases = [
      ...MODEL.tasks.filter((t) => !SKIPPED.has(t.status)).map((t) => ({ id: t.id, task: t.id, url: fileUrl(CFG.url) })),
      ...(CFG.variants || []).map((v) => ({ ...v, url: fileUrl(v.url || CFG.url) })),
    ].filter((c) => !only || only.includes(c.id) || only.includes(c.task));
    if (!cases.length) { console.error('No tasks matched.'); process.exitCode = 2; return; }
    assertGradeable(cases.map((c) => c.task));
    const rows = [];
    for (const c of cases) {
      const t0 = Date.now();
      const scanner = await run(browser, c, 'scanner');
      const reader = await run(browser, c, 'reader');
      const load = {};
      // Load conditions: a laptop screen (the fold hides more), an interruption mid-task, and the goal in the user's own words.
      if (!flag('no-load')) for (const cond of ['laptop', 'interrupt', 'paraphrase']) load[cond] = await run(browser, c, 'scanner', cond);
      const loadMean = flag('no-load') ? null : +(Object.values(load).reduce((s, r) => s + r.success, 0) / 3).toFixed(2);
      const row = { id: c.id, scanner, reader, load, robust: loadMean, fragility: loadMean == null ? null : +(scanner.success - loadMean).toFixed(2), observed: c.observed || OBSERVED[c.id] || null, secs: Math.round((Date.now() - t0) / 1000) };
      for (const r of [row.scanner, row.reader, ...Object.values(row.load)]) delete r.raw;
      rows.push(row); console.log(JSON.stringify(row));
      fs.writeFileSync(path.join(OUT, 'sim-results.json'), JSON.stringify(rows, null, 2));
    }
    console.log(`wrote ${path.join(OUT, 'sim-results.json')} · model calls ${calls}`);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exitCode = 3;
  } finally {
    await browser.close(); saveCache();
  }
})();
