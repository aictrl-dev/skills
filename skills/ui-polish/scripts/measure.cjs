#!/usr/bin/env node
/* Mechanical UI checks for the ui-polish skill.
 *
 * Renders a page at phone and desktop width and measures what a model is bad at judging from a
 * screenshot: column alignment, field widths, label placement, tap targets, input font size, text
 * size, contrast, overflow, dead space and the distance to the primary action.
 *
 * Usage:
 *   node measure.cjs <file-or-url> [--out <dir>] [--scope <css selector>] [--viewports phone,desktop]
 *                    [--primary <css selector>] [--js] [--offline | --assets-only]
 *
 * --offline      no network at all: only the target and file:/data: resources load (hermetic).
 * --assets-only  allow the page itself plus remote fonts, stylesheets and images, block scripts and data
 *                requests. Use it for saved copies that need their fonts; it does contact the asset hosts.
 *   node measure.cjs --compare <before.json> <after.json>
 *
 * Writes <out>/measure.json (all findings) and <out>/<viewport>.png, and prints a summary.
 * Exit code 1 when any "error" finding remains (so it can gate a fix loop), 2 on usage errors, 3 when the
 * run itself fails (missing browser, navigation error or timeout).
 *
 * Needs Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`
 * in the project, or run with NODE_PATH pointing at a node_modules that has it.
 */
const fs = require('fs');
const path = require('path');

const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1366, height: 900 } };
const TH = {
  alignPx: 2, // columns in repeated rows may differ by at most this
  widthPx: 2, // repeated fields may differ in width by at most this
  fillRatio: 0.75, // on phone, a row of fields should span at least this share of its column
  tapPx: 44, // minimum tap target (WCAG 2.5.5 AAA)
  tapErrorPx: 24, // below this a tap target is an error (WCAG 2.5.8 AA minimum)
  inputFontPx: 16, // below this, iOS Safari zooms on focus
  textPx: 14, // body text smaller than this is flagged
  contrast: 4.5, // WCAG AA for normal text
  contrastLarge: 3, // WCAG AA for large text (>= 24px, or >= 18.66px bold)
  deadSpaceVh: 0.3, // a vertical gap inside the content above the primary action larger than this share of the viewport
  actionGapVh: 0.25, // distance from the last field to the primary action larger than this share of the viewport
  typeScaleMax: 6, // more distinct font sizes than this in the scope is reported
};

// Page text is untrusted: strip control characters (ANSI/OSC escapes) before printing it to a terminal.
const safe = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');

function usage(msg) {
  if (msg) console.error(msg);
  console.error('Usage: node measure.cjs <file-or-url> [--out dir] [--scope selector] [--viewports phone,desktop] [--primary selector] [--js] [--offline | --assets-only]\n       node measure.cjs --compare before.json after.json');
  process.exit(2);
}

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch { /* try the next one */ }
  }
  console.error('Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium` in the project, or set NODE_PATH to a node_modules that has it.');
  process.exit(2);
}

// ---------------------------------------------------------------- compare mode
function compare(beforeFile, afterFile) {
  const a = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const b = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  // Key on a stable anchor (id, name, aria-label, placeholder) when the element has one, so inserting a
  // sibling during a fix does not shift nth-of-type indexes and turn an unchanged finding into a "new" one.
  const key = (f) => `${f.viewport}|${f.check}|${f.anchor || f.selector}`;
  const before = new Map(a.findings.map((f) => [key(f), f]));
  const after = new Map(b.findings.map((f) => [key(f), f]));
  const fixed = [...before.keys()].filter((k) => !after.has(k)).map((k) => before.get(k));
  const remaining = [...after.keys()].filter((k) => before.has(k)).map((k) => after.get(k));
  const added = [...after.keys()].filter((k) => !before.has(k)).map((k) => after.get(k));
  // New copy: anything visible after that was not visible before. A digit outside [brackets] is a number
  // the original screen never stated, which the skill forbids unless it is a placeholder for the owner.
  const oldCopy = new Set(a.copy || []);
  const newCopy = (b.copy || []).filter((t) => !oldCopy.has(t));
  const unbracketed = newCopy.filter((t) => /\d/.test(t.replace(/\[[^\]]*\]/g, '')));
  const line = (f) => `  [${f.severity}] ${f.viewport} ${f.check} — ${safe(f.message)}`;
  console.log(`Fixed ${fixed.length} · remaining ${remaining.length} · new ${added.length}`);
  if (fixed.length) console.log('Fixed:\n' + fixed.map(line).join('\n'));
  if (remaining.length) console.log('Remaining:\n' + remaining.map(line).join('\n'));
  if (added.length) console.log('New (regressions):\n' + added.map(line).join('\n'));
  if (newCopy.length) console.log('New copy for the owner to review:\n' + newCopy.map((t) => `  "${safe(t)}"`).join('\n'));
  if (unbracketed.length) console.log('[error] invented-number: new copy contains numbers outside [brackets]:\n' + unbracketed.map((t) => `  "${safe(t)}"`).join('\n'));
  process.exit(unbracketed.length || added.some((f) => f.severity === 'error') || remaining.some((f) => f.severity === 'error') ? 1 : 0);
}

// ---------------------------------------------------------------- in-page measurement
// Runs inside the page; must be self-contained.
function measureInPage({ scopeSel, primarySel, TH }) {
  const vw = innerWidth; const vh = innerHeight;
  const scope = (scopeSel && document.querySelector(scopeSel)) || document.querySelector('main') || document.body;
  const findings = [];
  const add = (check, severity, el, message, measured, expected) => findings.push({ check, severity, selector: sel(el), anchor: anchor(el), message, measured, expected });
  function anchor(el) {
    if (!el || el.nodeType !== 1) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return `#${el.id}`;
    for (const a of ['name', 'aria-label', 'placeholder', 'for', 'data-testid']) { const v = el.getAttribute(a); if (v) return `${tag}[${a}="${v}"]`; }
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t && t.length <= 40 && el.children.length === 0 ? `${tag}:text("${t}")` : '';
  }

  function sel(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(`#${CSS.escape(e.id)}`); break; }
      const nm = e.getAttribute('name'); if (nm) s += `[name="${nm}"]`;
      const parent = e.parentElement;
      if (parent) { const same = [...parent.children].filter((c) => c.tagName === e.tagName); if (same.length > 1) s += `:nth-of-type(${same.indexOf(e) + 1})`; }
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom + scrollY) }; };
  const textInputSel = 'input:not([type]), input[type="text"], input[type="number"], input[type="email"], input[type="tel"], input[type="search"], input[type="password"], input[type="url"], input[type="date"], select, textarea';
  const fields = [...scope.querySelectorAll(textInputSel)].filter(visible);

  // accessible name
  const accName = (el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l.textContent.trim(); }
    const wrap = el.closest('label'); if (wrap) return wrap.textContent.trim();
    return (el.getAttribute('title') || '').trim();
  };

  // ---- C1/C2 alignment and equal widths across repeated rows of fields
  const rows = [];
  for (const f of fields.map((el) => ({ el, ...rect(el) })).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r.y - f.y) <= 8);
    if (row) row.items.push(f); else rows.push({ y: f.y, items: [f] });
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].items; const b = rows[i].items;
    if (a.length < 2 || a.length !== b.length) continue;
    for (let k = 0; k < a.length; k++) {
      const dx = Math.abs(a[k].x - b[k].x);
      if (dx > TH.alignPx) add('column-alignment', 'error', b[k].el, `Field ${k + 1} of this row is ${dx}px out of line with the same column in the row above`, dx, `<= ${TH.alignPx}px`);
    }
  }
  // equal widths: compare each field with the same column in the next row of the same shape
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].items; const b = rows[i].items;
    if (a.length < 2 || a.length !== b.length) continue;
    for (let k = 0; k < a.length; k++) {
      const dw = Math.abs(a[k].w - b[k].w);
      if (dw > TH.widthPx) add('equal-widths', 'warn', b[k].el, `Field ${k + 1} of this row is ${b[k].w}px wide; the same column above is ${a[k].w}px`, dw, `<= ${TH.widthPx}px difference`);
    }
  }

  // ---- C3 field fill on narrow screens
  if (vw <= 480) {
    for (const r of rows) {
      const span = Math.max(...r.items.map((it) => it.r)) - Math.min(...r.items.map((it) => it.x));
      // the column is the nearest block-level ancestor that contains every field of the row
      let col = r.items[0].el.parentElement;
      while (col && col !== document.body && (!r.items.every((it) => col.contains(it.el)) || getComputedStyle(col).display.startsWith('inline'))) col = col.parentElement;
      const cs = col ? getComputedStyle(col) : null;
      const colW = col ? col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : vw;
      const ratio = span / colW;
      if (ratio < TH.fillRatio) add('field-fill', 'warn', r.items[0].el, `Fields in this row span ${Math.round(ratio * 100)}% of the column on a ${vw}px screen`, +ratio.toFixed(2), `>= ${TH.fillRatio}`);
    }
  }

  // ---- C4 accessible names and C5 labels placed after the field
  for (const f of fields) {
    const name = accName(f);
    if (!name) add('accessible-name', 'error', f, 'Field has no accessible name (no <label for>, aria-label or aria-labelledby)', null, 'label');
    const fr = f.getBoundingClientRect();
    const next = f.nextElementSibling;
    if (next && visible(next) && next.tagName !== 'INPUT') {
      const nr = next.getBoundingClientRect();
      const txt = (next.textContent || '').trim();
      if (txt && txt.length <= 24 && nr.left >= fr.right - 2 && Math.abs((nr.top + nr.bottom) / 2 - (fr.top + fr.bottom) / 2) < fr.height / 2) {
        add('label-after-field', 'warn', f, `Label "${txt}" sits after the field; labels read and align better above it`, 'after', 'above');
      }
    }
  }

  // ---- C6 tap targets and C7 input font size
  const controls = [...scope.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary')].filter(visible);
  for (const c of controls) {
    if (c.type === 'hidden') continue;
    const r = c.getBoundingClientRect();
    const inline = c.tagName === 'A' && getComputedStyle(c).display === 'inline' && c.closest('p, li');
    if (inline) continue;
    const minSide = Math.min(r.height, r.width);
    if (minSide < TH.tapPx && vw <= 480) add('tap-target', minSide < TH.tapErrorPx ? 'error' : 'warn', c, `Tap target is ${Math.round(r.width)}×${Math.round(r.height)}px`, Math.round(Math.min(r.width, r.height)), `>= ${TH.tapPx}px`);
  }
  if (vw <= 480) for (const f of fields) {
    const fs = parseFloat(getComputedStyle(f).fontSize);
    if (fs < TH.inputFontPx) add('input-font-size', 'warn', f, `Field text is ${fs}px; iOS zooms the page on focus below 16px`, fs, `>= ${TH.inputFontPx}px`);
  }

  // ---- C8 text size, C9 contrast, C10 type scale
  // Effective background: collect the background layers from the element up to the first opaque one, then
  // alpha-composite them bottom-up (the canvas is white). Unknown under an image or gradient.
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return null;
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); if (!m) continue;
      const p = m[1].split(',').map(Number); const a = p.length > 3 ? p[3] : 1;
      if (a <= 0) continue;
      layers.push([p[0], p[1], p[2], a]);
      if (a >= 1) break;
    }
    let c = [255, 255, 255];
    for (const [r, g, b, a] of layers.reverse()) c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)];
    return c;
  };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const sizes = new Map(); const seenContrast = new Set(); let small = 0; let smallEl = null;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; const s = t.textContent.trim(); if (s.length < 2) continue;
    const el = t.parentElement; if (!el || !visible(el)) continue;
    const cs = getComputedStyle(el); const fsz = parseFloat(cs.fontSize);
    sizes.set(Math.round(fsz), (sizes.get(Math.round(fsz)) || 0) + 1);
    if (fsz < TH.textPx) { small++; smallEl = smallEl || el; }
    const fg = (cs.color.match(/rgba?\(([^)]+)\)/) || [])[1]; const bg = bgOf(el);
    if (fg && bg) {
      const c = ratio(fg.split(',').slice(0, 3).map(Number), bg);
      const large = fsz >= 24 || (fsz >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? TH.contrastLarge : TH.contrast;
      const k = sel(el);
      if (c < need && !seenContrast.has(k)) { seenContrast.add(k); add('contrast', 'error', el, `Text "${s.slice(0, 30)}" has contrast ${c.toFixed(2)}:1`, +c.toFixed(2), `>= ${need}:1`); }
    }
  }
  if (small) add('text-size', 'warn', smallEl, `${small} text runs are smaller than ${TH.textPx}px`, small, `0 below ${TH.textPx}px`);
  if (sizes.size > TH.typeScaleMax) add('type-scale', 'info', scope, `${sizes.size} different font sizes in use (${[...sizes.keys()].sort((a, b) => a - b).join(', ')}px)`, sizes.size, `<= ${TH.typeScaleMax}`);

  // ---- C11 horizontal overflow
  // Only visible overflow counts: content clipped by an ancestor (overflow hidden/clip/auto/scroll) that
  // itself fits the viewport does not make the page scroll sideways.
  const clipped = (e) => { for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox !== 'visible' && a.getBoundingClientRect().right <= vw + 1) return true; } return false; };
  const over = [...scope.querySelectorAll('*')].filter((e) => visible(e) && e.getBoundingClientRect().right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !clipped(e));
  const outer = over.filter((e) => !over.some((o) => o !== e && o.contains(e)));
  // body overflow propagates to the viewport when html's is visible; a clipping viewport cannot scroll sideways
  const vpOverflow = getComputedStyle(document.documentElement).overflowX !== 'visible' ? getComputedStyle(document.documentElement).overflowX : getComputedStyle(document.body).overflowX;
  const pageScrolls = !['hidden', 'clip'].includes(vpOverflow) && document.documentElement.scrollWidth > vw + 1;
  if (pageScrolls || outer.length) add('overflow', 'error', outer[0] || document.body, `Content extends past the ${vw}px viewport`, document.documentElement.scrollWidth, `<= ${vw}px`);

  // ---- C12 heading, C13 dead space and distance to the primary action
  const heads = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')].filter(visible);
  if (!heads.length) add('heading', 'warn', scope, 'No visible heading in the content; the question is not in the heading outline', 0, '>= 1');
  const primary = (primarySel && document.querySelector(primarySel)) || [...scope.querySelectorAll('button[type="submit"], button, [role="button"]')].filter(visible).sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
  if (primary && fields.length) {
    const lastField = fields.reduce((m, f) => (f.getBoundingClientRect().bottom > m.getBoundingClientRect().bottom ? f : m));
    const pr = primary.getBoundingClientRect(); const lf = lastField.getBoundingClientRect();
    const gap = pr.top - lf.bottom;
    if (gap > TH.actionGapVh * vh) add('action-distance', 'warn', primary, `The primary action is ${Math.round(gap)}px below the last field`, Math.round(gap), `<= ${Math.round(TH.actionGapVh * vh)}px`);
    if (pr.bottom > vh && gap > 0 && lf.bottom < vh) add('action-below-fold', 'error', primary, 'The primary action is below the first screen while the fields fit on it', Math.round(pr.bottom), `<= ${vh}px`);
    // largest empty band between content blocks above the action
    const blocks = [...scope.querySelectorAll('h1,h2,h3,p,label,legend,input,select,textarea,button,a,img,svg')].filter(visible).map((e) => e.getBoundingClientRect()).filter((r) => r.bottom <= pr.top + 1).sort((a, b) => a.top - b.top);
    let maxGap = 0; let bottom = blocks.length ? blocks[0].bottom : 0;
    for (const r of blocks) { if (r.top - bottom > maxGap) maxGap = r.top - bottom; bottom = Math.max(bottom, r.bottom); }
    if (pr.top - bottom > maxGap) maxGap = pr.top - bottom;
    if (maxGap > TH.deadSpaceVh * vh) add('dead-space', 'warn', primary, `An empty band of ${Math.round(maxGap)}px sits inside the content above the primary action`, Math.round(maxGap), `<= ${Math.round(TH.deadSpaceVh * vh)}px`);
  }

  // visible copy, for the compare step's new-copy review
  const copy = []; const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const t = tw.currentNode.textContent.replace(/\s+/g, ' ').trim(); const el = tw.currentNode.parentElement; if (t && el && visible(el) && !copy.includes(t)) copy.push(t); }
  for (const el of scope.querySelectorAll('[placeholder], [aria-label]')) for (const a of ['placeholder', 'aria-label']) { const v = (el.getAttribute(a) || '').trim(); if (v && !copy.includes(v)) copy.push(v); }
  return { viewport: { width: vw, height: vh }, fieldCount: fields.length, rows: rows.map((r) => r.items.map((it) => ({ x: it.x, w: it.w }))), copy, findings };
}

// ---------------------------------------------------------------- main
(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--compare') { if (args.length < 3) usage('Missing files to compare'); return compare(args[1], args[2]); }
  const target = args.find((a, i) => !a.startsWith('--') && !['--out', '--scope', '--viewports', '--primary'].includes(args[i - 1]));
  if (!target) usage('Missing <file-or-url>');
  const opt = (n, d) => {
    const i = args.indexOf(`--${n}`); if (i < 0) return d;
    const v = args[i + 1]; if (v === undefined || v.startsWith('--')) usage(`--${n} needs a value`);
    return v;
  };
  const out = path.resolve(opt('out', 'ui-polish-out'));
  const wanted = opt('viewports', 'phone,desktop').split(',').map((v) => v.trim()).filter(Boolean);
  for (const v of wanted) if (!VIEWPORTS[v]) usage(`Unknown viewport "${v}" (use phone, desktop)`);
  const url = /^https?:\/\//.test(target) ? target : require('url').pathToFileURL(path.resolve(target)).href;
  const { chromium } = loadPlaywright();
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const result = { target, measuredAt: new Date().toISOString(), thresholds: TH, viewports: {}, findings: [] };
  try {
    for (const v of wanted) {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[v], javaScriptEnabled: args.includes('--js'), deviceScaleFactor: 1 });
      if (args.includes('--offline') || args.includes('--assets-only')) {
        const assets = args.includes('--assets-only');
        await ctx.route('**/*', (r) => {
          const q = r.request(); const u = q.url();
          if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
          if (q.isNavigationRequest() && !q.frame().parentFrame()) return r.continue(); // the target page itself, including redirects
          return assets && ['font', 'stylesheet', 'image'].includes(q.resourceType()) ? r.continue() : r.abort();
        });
      }
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(600);
      const r = await page.evaluate(measureInPage, { scopeSel: opt('scope', null), primarySel: opt('primary', null), TH });
      await page.screenshot({ path: path.join(out, `${v}.png`) });
      result.viewports[v] = { fieldCount: r.fieldCount, rows: r.rows };
      result.copy = [...new Set([...(result.copy || []), ...r.copy])];
      for (const f of r.findings) result.findings.push({ viewport: v, ...f });
      await ctx.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(result, null, 2));
  const count = (s) => result.findings.filter((f) => f.severity === s).length;
  console.log(`${target}\n${count('error')} errors · ${count('warn')} warnings · ${count('info')} info  →  ${path.join(out, 'measure.json')}`);
  for (const f of result.findings) console.log(`  [${f.severity}] ${f.viewport} ${f.check}: ${safe(f.message)}${f.selector ? `  (${safe(f.selector)})` : ''}`);
  process.exit(count('error') ? 1 : 0);
})().catch((e) => { console.error('measure failed:', e.message); process.exit(3); });
