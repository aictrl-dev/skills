// Replays recorded tester sessions to show what testers did on the real screens.
//
// For each experiment arm it re-runs each session's clicks from the harness log, saving a screenshot before
// every click and the clicked element's box (for click clouds and step strips), plus the arm's first screen.
// With a simulator backend configured (TYPESAFE_API_KEY, or UX_SIM_ENDPOINT + UX_SIM_API_KEY + UX_SIM_MODEL)
// it also predicts where a busy first-time user would click first on that screen; without one it skips the
// prediction and says so. Keys are read from the environment only and never logged.
//
// Usage (needs Playwright with Chromium):
//   node replay.cjs --config replay.config.json --out <dir> [--steps 5]
// Relative paths in the config resolve against the config's directory.
// Writes <dir>/replays.json and <dir>/img/*.jpg. See reference/visual-report.md for the config and the page.
const fs = require('fs');
const path = require('path');
const { loadPlaywright, simBackend } = require('./common.cjs');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
if (!opt('config') || !opt('out')) { console.error('Usage: node replay.cjs --config replay.config.json --out <dir>'); process.exit(2); }

const { chromium } = loadPlaywright();
const CONFIG_PATH = path.resolve(opt('config'));
const CONFIG_DIR = path.dirname(CONFIG_PATH);
const CFG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const OUT = path.resolve(opt('out'));
const MAX_STEPS = Number(opt('steps', 5));
const SIM = simBackend();
if (SIM.error) console.warn('No simulator backend configured: replaying sessions without first-click predictions. Set TYPESAFE_API_KEY (https://typesafe.ai) or UX_SIM_ENDPOINT + UX_SIM_API_KEY + UX_SIM_MODEL to add them.');
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const fileUrl = (p) => (/^(https?|file):/.test(p) ? p : `file://${path.resolve(CONFIG_DIR, p)}`);
const HIDE_SEL = CFG.hideCss ? CFG.hideCss.split('{')[0] : '';
const REGIONS = { chat: '[data-ux-chat]', menu: 'nav', topbar: 'header', ...(CFG.regions || {}) };

const ROLES = ['button', 'link', 'tab', 'radio', 'checkbox', 'option', 'menuitem', 'combobox'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Same matching order as the harness: exact name, then names starting with the text. Older logs (before the
// harness recorded `clicked`) may need the substring fallback, which the harness itself no longer uses.
async function find(page, name) {
  const tries = [];
  for (const r of ROLES) tries.push(page.getByRole(r, { name, exact: true }));
  for (const r of ROLES) tries.push(page.getByRole(r, { name: new RegExp('^\\s*' + esc(name), 'i') }));
  for (const r of ROLES) tries.push(page.getByRole(r, { name: new RegExp(esc(name), 'i') }));
  tries.push(page.getByText(name, { exact: true }));
  for (const t of tries) { const v = t.filter({ visible: true }); if (await v.count()) return v.first(); }
  return null;
}

async function open(browser, url, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(fileUrl(url));
  if (CFG.scenarioSelect && CFG.scenario) await page.selectOption(CFG.scenarioSelect, CFG.scenario);
  if (CFG.hideCss) await page.addStyleTag({ content: CFG.hideCss });
  await page.waitForTimeout(600);
  return page;
}

async function hasChat(browser, exp, arm) {
  const page = await open(browser, arm.url, exp.viewport);
  try { return (await page.locator(`${REGIONS.chat} textarea`).count()) > 0; } finally { await page.close(); }
}

const box = (b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };

async function replay(browser, exp, arm, sid, outcome) {
  const log = fs.readFileSync(path.resolve(CONFIG_DIR, arm.log), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.session === sid);
  if (!log.length) throw new Error(`No log entries for session ${sid} in ${arm.log}`);
  const page = await open(browser, arm.url, exp.viewport);
  const steps = [];
  for (const e of log) {
    if (steps.length >= MAX_STEPS) break;
    if (e.action === 'wait') { await page.waitForTimeout(Math.min(Number(e.args[0]) || 1000, 3000)); continue; }
    if (e.action === 'press') { await page.keyboard.press(e.args[0]); await page.waitForTimeout(400); continue; }
    if (e.action !== 'click') continue;
    const name = e.clicked || e.args.join(' ');
    const loc = await find(page, name);
    if (!loc) { steps.push({ label: name, missing: true }); continue; }
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const img = `img/${exp.id}-${arm.arm}-${sid}-${steps.length}.jpg`;
    await page.screenshot({ path: path.join(OUT, img), type: 'jpeg', quality: 72 });
    steps.push({ label: name, img, box: box(await loc.boundingBox()) });
    await loc.click(); await page.waitForTimeout(1200);
  }
  const end = `img/${exp.id}-${arm.arm}-${sid}-end.jpg`;
  await page.screenshot({ path: path.join(OUT, end), type: 'jpeg', quality: 72 });
  await page.close();
  const missing = steps.filter((s) => s.missing).length;
  if (missing) console.warn(`${sid}: ${missing} click(s) could not be matched on replay`);
  return { session: sid, outcome, steps, end };
}

// The first screen, and (with a simulator backend) where a busy first-time user would click first.
async function firstScreen(browser, exp, arm) {
  const page = await open(browser, arm.url, exp.viewport);
  const img = `img/${exp.id}-${arm.arm}-first.jpg`;
  await page.screenshot({ path: path.join(OUT, img), type: 'jpeg', quality: 72 });
  const g = await page.evaluate(({ HIDE_SEL, R }) => {
    const vh = innerHeight; const out = []; const seen = new Set();
    for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], input[type="radio"], input[type="checkbox"], select')) {
      if (HIDE_SEL && el.closest(HIDE_SEL)) continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || r.top >= vh - 4 || r.bottom <= 0) continue;
      const txt = (el.innerText || '').trim().replace(/\s+/g, ' '); const aria = (el.getAttribute('aria-label') || txt).trim();
      const key = aria || `icon@${Math.round(r.x)},${Math.round(r.y)}`;
      if (seen.has(key)) continue; seen.add(key);
      const within = (sel) => { try { return sel && el.closest(sel); } catch { return false; } };
      const region = within(R.menu) ? 'menu' : within(R.chat) ? 'chat' : within(R.topbar) ? 'top bar' : 'page';
      out.push({ label: txt || (aria ? `(icon) ${aria}` : '(icon, no label)'), region, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
    }
    let text = ''; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode() && text.length < 1600) {
      const n = w.currentNode; const s = n.textContent.trim(); if (!s) continue;
      if (!n.parentElement || n.parentElement.closest('script,style,noscript') || (HIDE_SEL && n.parentElement.closest(HIDE_SEL))) continue;
      const r = n.parentElement.getBoundingClientRect(); if (r.height === 0 || r.top > vh) continue;
      text += s + ' | ';
    }
    return { out, text };
  }, { HIDE_SEL, R: REGIONS });
  await page.close();
  if (SIM.error) return { img, probs: null };
  const criteria = {}; g.out.forEach((c, i) => { criteria['c' + i] = `"${c.label}" (${c.region})`; });
  criteria.__scroll = 'Scroll down to see more';
  if (await hasChat(browser, exp, arm)) criteria.__chat = 'Type into the chat box';
  const state = { user: 'A busy first-time user of this web app. They glance at the screen and act on the first control that seems to lead to their goal; they do not read everything.', task: exp.task, screen: { readable_now: g.text } };
  const questions = { next: { type: 'choice', instructions: 'Which one thing would this user do next to make progress on the `task`, judging only from what they can see on the `screen`?', criteria } };
  let j;
  try { j = await SIM.ask(state, questions); } catch (e) { throw new Error(`${e.message} for ${exp.id} ${arm.arm}`); }
  const probs = Object.entries(j.answers.next.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => {
    if (k.startsWith('__')) return { label: k === '__scroll' ? 'Scroll down' : 'Type in chat', p: +v.toFixed(2) };
    const c = g.out[Number(k.slice(1))];
    return { label: c.label, box: c.box, p: +v.toFixed(2) };
  });
  return { img, probs };
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(`ERROR: could not start Chromium (${String(e.message).split('\n')[0]}). Run \`npx playwright install chromium\`.`);
    process.exit(3);
  }
  const data = { experiments: [] };
  try {
    for (const exp of CFG.experiments) {
      const e = { id: exp.id, title: exp.title, viewport: exp.viewport, task: exp.task, arms: [] };
      for (const arm of exp.arms) {
        const sessions = [];
        for (const [sid, outcome] of arm.sessions) sessions.push(await replay(browser, exp, arm, sid, outcome));
        const prediction = await firstScreen(browser, exp, arm);
        e.arms.push({ arm: arm.arm, label: arm.label, sessions, prediction });
        console.log(`${exp.id} ${arm.arm}: ${sessions.map((s) => `${s.session} ${s.steps.length} clicks`).join(', ')}`);
      }
      data.experiments.push(e);
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'replays.json'), JSON.stringify(data, null, 1));
  console.log(`wrote ${path.join(OUT, 'replays.json')}`);
})();
