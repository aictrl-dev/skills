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
// Options: --out <dir> (default: a new temp dir), --cache <file>, --workers <n>, --seed <n>.
//
// Needs a simulator backend: TYPESAFE_API_KEY (TypeSafe Jev), or UX_SIM_ENDPOINT + UX_SIM_API_KEY +
// UX_SIM_MODEL for a compatible endpoint. Without one it exits with code 2 and says how to set one up.
// Keys are read from the environment only and never logged or written.
// See reference/simulator.md for the config, the request/response contract, conditions and limits.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { loadPlaywright, loadModel, requireSimBackend } = require('./common.cjs');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);
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
const STATE_HOOK = CFG.stateHook || (MODEL.meta && MODEL.meta.state_hook) || '__state';
const observedPath = CFG.observed && path.resolve(CONFIG_DIR, CFG.observed);
const OBSERVED = observedPath && fs.existsSync(observedPath) ? JSON.parse(fs.readFileSync(observedPath, 'utf8')) : {};
const OUT = path.resolve(opt('out') || fs.mkdtempSync(path.join(os.tmpdir(), 'ux-sim-')));
fs.mkdirSync(OUT, { recursive: true });

const N = Number(opt('n', 16));
const WORKERS = Number(opt('workers', 4));
const MAX_STEPS = 16; // a path longer than this counts as a failure ("too-long")
const MAX_CHATS = 3; // a user who types into the chat more than this gives up
const STOP_MIN = 0.3; // a user only considers stopping when the model's stop probability reaches this
const SETTLE_MS = 1100;
const LAPTOP = { width: 1366, height: 768 };
const DESKTOP = { width: 1440, height: 900 };
const REGIONS = { main: 'main', chat: '[data-ux-chat]', menu: 'nav', topbar: 'header', ...(CFG.regions || {}) };
const HIDE = CFG.hideCss || '';
const HIDE_SEL = HIDE ? HIDE.split('{')[0] : '';

// Answers depend only on what the user sees, so they are cached per screen (and per backend); re-runs cost nothing.
// The cache holds screen text and probabilities, never keys.
const CACHE_F = path.resolve(opt('cache', path.join(OUT, '.sim-cache.json')));
const cache = fs.existsSync(CACHE_F) ? JSON.parse(fs.readFileSync(CACHE_F, 'utf8')) : {};
let calls = 0; let dirty = 0;
const saveCache = () => { if (dirty) { fs.writeFileSync(CACHE_F, JSON.stringify(cache)); dirty = 0; } };

let seed = Number(opt('seed', 42));
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const sample = (dist) => { const r = rnd(); let acc = 0; for (const [k, v] of dist) { acc += v; if (r <= acc) return k; } return dist[dist.length - 1][0]; };

const SEL = 'button, a[href], [role="button"], [role="tab"], input[type="radio"], input[type="checkbox"], summary, select';

// Perception is code, not the model. A "scanner" sees only what is on screen without scrolling (the 14 most
// prominent page controls, icons as symbols); a "reader" gets every control's accessible name and all page text.
async function perceive(page, profile) {
  return page.evaluate(({ profile, SEL, R, HIDE_SEL, ROW, ROW_TITLE }) => {
    const vh = innerHeight;
    const hidden = (el) => HIDE_SEL && el.closest(HIDE_SEL);
    const within = (el, sel) => { try { return sel && el.closest(sel); } catch { return false; } };
    const regionOf = (el) => (within(el, R.menu) ? 'menu' : within(el, R.chat) ? 'chat' : within(el, R.topbar) ? 'topbar' : within(el, R.main) ? 'main' : 'side');
    const mainEl = document.querySelector(R.main) || document.body;
    const mainBox = mainEl.getBoundingClientRect();
    const els = [...document.querySelectorAll(SEL)].filter((el) => !hidden(el));
    const out = []; let below = 0; let above = 0;
    els.forEach((el, idx) => {
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
  }, { profile, SEL, R: REGIONS, HIDE_SEL, ROW: CFG.rowSelector || '', ROW_TITLE: CFG.rowTitleSelector || '' });
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
  const k = crypto.createHash('sha1').update(JSON.stringify([BACKEND.endpoint, BACKEND.model, state, criteria, Object.keys(questions)])).digest('hex');
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
    const box = page.locator(`${REGIONS.chat} textarea:visible`).last();
    await box.fill(prompt, { timeout: 5000 }); await box.press('Enter'); await page.waitForTimeout(SETTLE_MS + 600); return;
  }
  const c = g.controls[Number(a.slice(1))];
  await page.evaluate(({ idx, SEL, HIDE_SEL }) => {
    const el = [...document.querySelectorAll(SEL)].filter((e) => !(HIDE_SEL && e.closest(HIDE_SEL)))[idx];
    if (!el) throw new Error('control gone');
    if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click();
  }, { idx: c.idx, SEL, HIDE_SEL });
  await page.waitForTimeout(SETTLE_MS);
}

// Evaluates the task model's own success / must_not expressions in the page. `S` is the page's read-only
// state hook (window[stateHook], default window.__state) when it has one; expressions may also query the DOM.
// Test harness only: the expressions come from the author's own task model file.
async function check(page, task) {
  return page.evaluate(([s, n, meta, hook]) => {
    const S = window[hook]; const META = meta; // eslint-disable-line no-unused-vars
    const ev = (e) => { if (!e) return null; try { return !!eval(e); } catch (x) { return null; } }; // eslint-disable-line no-eval
    return { success: ev(s), harm: ev(n) };
  }, [task.success, task.must_not, MODEL.meta || {}, STATE_HOOK]);
}

function viewportFor(task, cond) {
  if (cond === 'laptop') return LAPTOP;
  const v = task.start && task.start.viewport;
  return v ? { width: v[0], height: v[1] } : DESKTOP;
}

async function walkOne(browser, c, task, profile, cond) {
  const page = await browser.newPage({ viewport: viewportFor(task, cond) });
  try {
    await page.goto(c.url);
    const scenario = c.scenario || (task.start && task.start.scenario);
    if (CFG.scenarioSelect && scenario && scenario !== 'cold') await page.selectOption(CFG.scenarioSelect, scenario);
    if (HIDE) await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout((CFG.slowScenarios || {})[scenario] || 500);
    if (c.mutate) await page.evaluate(c.mutate);
    const hasChat = (await page.locator(`${REGIONS.chat} textarea`).count()) > 0;
    const isQuestion = !task.success; const facts = (task.answer || []).map((f) => String(f).toLowerCase());
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
        const right = J.correct != null ? rnd() < J.correct : facts.every((f) => (g.text + ' ' + g.chat).toLowerCase().includes(f));
        return { end: right ? 'success' : 'wrong-answer', steps: step, trail };
      }
      const a = sample(Object.entries(J.next).sort((x, y) => y[1] - x[1]));
      if (a === '__give_up') return { end: 'give-up', steps: step, trail };
      if (a === '__type_chat' && ++chats > MAX_CHATS) return { end: 'give-up', steps: step, trail };
      trail.push(a.startsWith('__') ? a.slice(2) : g.controls[Number(a.slice(1))].label.slice(0, 40));
      await act(page, g, a, task.prompt);
    }
  } catch (e) {
    // A backend failure is not a usability result: stop the run rather than score it as a user error.
    if (/^simulator /.test(e.message)) throw e;
    return { end: 'error', steps: 0, trail: [String(e.message).slice(0, 80)] };
  } finally { await page.close(); }
}

async function run(browser, c, profile, cond = 'focused') {
  const task = TASKS[c.task];
  if (!task) throw new Error(`Task ${c.task} is not in the model`);
  const results = []; let started = 0;
  const worker = async () => { while (started < N) { started++; results.push(await walkOne(browser, c, task, profile, cond)); } };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  saveCache();
  const count = (e) => results.filter((r) => r.end === e).length;
  const ok = results.filter((r) => r.end === 'success');
  const ends = {}; results.forEach((r) => { ends[r.end] = (ends[r.end] || 0) + 1; });
  const fails = {}; results.filter((r) => r.end !== 'success').forEach((r) => { const k = `${r.end}: ${r.trail.slice(0, 4).join(' → ') || '(start)'}`; fails[k] = (fails[k] || 0) + 1; });
  return {
    raw: results.map((r) => ({ ok: r.end === 'success' ? 1 : 0, harm: r.end === 'harm' ? 1 : 0, steps: r.steps })),
    success: +(count('success') / N).toFixed(2),
    harm: +(count('harm') / N).toFixed(2),
    steps: ok.length ? +(ok.reduce((s, r) => s + r.steps, 0) / ok.length).toFixed(1) : null,
    ends,
    topFail: Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([k, v]) => `${v}× ${k}`)[0] || '',
  };
}

// 90% bootstrap interval for the difference B − A.
function boot(a, b, key, iters = 2000) {
  const mean = (xs) => xs.reduce((s, x) => s + x[key], 0) / xs.length; const ds = [];
  for (let i = 0; i < iters; i++) {
    const ra = a.map(() => a[Math.floor(rnd() * a.length)]); const rb = b.map(() => b[Math.floor(rnd() * b.length)]);
    ds.push(mean(rb) - mean(ra));
  }
  ds.sort((x, y) => x - y);
  return { delta: +(mean(b) - mean(a)).toFixed(2), lo: +ds[Math.floor(iters * 0.05)].toFixed(2), hi: +ds[Math.floor(iters * 0.95)].toFixed(2) };
}

async function hypothesis(browser, H, hypDir) {
  const rows = [];
  const variant = (v, tid) => ({ id: tid, task: tid, url: v && v.url ? fileUrl(v.url, hypDir) : fileUrl(CFG.url), mutate: v && v.mutate });
  const stepsOf = (R) => { const ok = R.raw.filter((r) => r.ok); return ok.length ? +(ok.reduce((t, r) => t + r.steps, 0) / ok.length).toFixed(1) : null; };
  const verdict = (x) => (x.lo > 0 ? 'B higher' : x.hi < 0 ? 'B lower' : 'no clear difference');
  for (const tid of H.tasks) {
    for (const cond of H.conds || ['focused']) {
      const A = await run(browser, variant(H.a, tid), 'scanner', cond);
      const B = await run(browser, variant(H.b, tid), 'scanner', cond);
      const s = boot(A.raw, B.raw, 'ok'); const h = boot(A.raw, B.raw, 'harm');
      const row = { task: tid, cond, A: A.success, B: B.success, stepsA: stepsOf(A), stepsB: stepsOf(B), success: { ...s, verdict: verdict(s) }, harmA: A.harm, harmB: B.harm, harm: { ...h, verdict: verdict(h) }, failA: A.topFail, failB: B.topFail };
      rows.push(row); console.log(JSON.stringify(row));
    }
  }
  return rows;
}

(async () => {
  console.log(`simulator: ${BACKEND.label} · output ${OUT}`);
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
      const rows = await hypothesis(browser, H, path.dirname(hypPath));
      const file = path.join(OUT, `hyp-${H.id}.json`);
      fs.writeFileSync(file, JSON.stringify({ H, n: N, rows }, null, 2));
      console.log(`wrote ${file} · model calls ${calls}`);
      return;
    }
    const only = opt('tasks') ? opt('tasks').split(',') : null;
    const cases = [
      ...MODEL.tasks.filter((t) => t.status !== 'needs-mock' && t.status !== 'needs-target').map((t) => ({ id: t.id, task: t.id, url: fileUrl(CFG.url) })),
      ...(CFG.variants || []).map((v) => ({ ...v, url: fileUrl(v.url || CFG.url) })),
    ].filter((c) => !only || only.includes(c.id) || only.includes(c.task));
    if (!cases.length) { console.error('No tasks matched.'); process.exitCode = 2; return; }
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
