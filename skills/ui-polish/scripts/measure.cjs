#!/usr/bin/env node
/* Mechanical UI checks for the ui-polish skill.
 *
 * Renders a page at phone and desktop width and measures what a model is bad at judging from a
 * screenshot: column alignment, field widths, label placement, tap targets, input font size, text
 * size, contrast, overflow, dead space and the distance to the primary action.
 *
 * Usage:
 *   node measure.cjs <file-or-url> [<file-or-url> …] [--out <dir>] [--scope <css selector>]
 *                    [--viewports phone,desktop] [--primary <css selector>] [--js] [--offline | --assets-only]
 *                    [--hide "<selector>[,<selector>…]"] [--profile form|content] [--config <path>]
 *   node measure.cjs --compare <before.json> <after.json>
 *
 * --offline      no network at all: only the target and file:/data: resources load (hermetic).
 * --assets-only  allow the page itself plus remote fonts, stylesheets and images, block scripts and data
 *                requests. Use it for saved copies that need their fonts; it does contact the asset hosts.
 * --hide         set display:none on these elements (cookie banners, chat launchers) before measuring and capturing.
 * --profile      form (default) runs every check; content skips the form-step checks (type-scale,
 *                action-distance, action-below-fold, dead-space) for long-form pages.
 * --config       a ui-polish.config.json of accepted decisions; default ./ui-polish.config.json when present.
 *                Shape: { "ignore": [{ "check": "text-size", "selector": ".eyebrow", "reason": "…" }] }.
 *                Matching findings move to "accepted" with their reason and do not affect the exit code.
 *
 * Writes <out>/measure.json (all findings), <out>/<viewport>.png (the first screen) and
 * <out>/<viewport>-scope.png (the whole scope element), and prints a summary. With several targets each
 * goes to <out>/<slug>/, and <out>/summary.json merges the same finding across pages.
 * Elements that share a cause are one finding with a count, example selectors and every member: fields with
 * the same small font size, controls with the same style and tap size, and small text (one finding per
 * viewport, broken down into style groups; eyebrow labels in their own info finding).
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
  labelGapPx: 12, // a checkbox or radio label at most this far from the control extends its tap target
  eyebrowMaxWords: 4, // small uppercase letter-spaced labels of at most this many words are the eyebrow pattern (info)
  eyebrowTrackingEm: 0.04, // minimum letter-spacing, in em, for the eyebrow pattern
  examples: 3, // example selectors listed per grouped finding
};
// Checks each profile skips. "form" is the default and runs everything.
const PROFILES = { form: [], content: ['type-scale', 'action-distance', 'action-below-fold', 'dead-space'] };
const VALUE_FLAGS = ['--out', '--scope', '--viewports', '--primary', '--hide', '--profile', '--config'];

// Page text is untrusted: strip control characters (ANSI/OSC escapes) before printing it to a terminal.
const safe = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');

class UsageError extends Error {}
function usage(msg) {
  if (msg) console.error(msg);
  console.error('Usage: node measure.cjs <file-or-url> [<file-or-url> …] [--out dir] [--scope selector] [--viewports phone,desktop] [--primary selector] [--js] [--offline | --assets-only] [--hide selectors] [--profile form|content] [--config file]\n       node measure.cjs --compare before.json after.json');
  process.exit(2);
}

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch { /* try the next one */ }
  }
  console.error('Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium` in the project, or set NODE_PATH to a node_modules that has it.');
  process.exit(2);
}

// ---------------------------------------------------------------- project config (accepted decisions)
function loadConfig(explicit) {
  const file = path.resolve(explicit || 'ui-polish.config.json');
  if (!fs.existsSync(file)) { if (explicit) usage(`Config not found: ${explicit}`); return { file: null, ignore: [] }; }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { usage(`Config ${file} is not valid JSON: ${e.message}`); }
  const ignore = cfg && cfg.ignore !== undefined ? cfg.ignore : [];
  if (!Array.isArray(ignore)) usage(`Config ${file}: "ignore" must be an array`);
  ignore.forEach((r, i) => {
    if (!r || typeof r !== 'object') usage(`Config ${file}: ignore[${i}] must be an object`);
    for (const k of ['check', 'selector']) if (r[k] !== undefined && typeof r[k] !== 'string') usage(`Config ${file}: ignore[${i}].${k} must be a string`);
    if (!r.check && !r.selector) usage(`Config ${file}: ignore[${i}] needs a "check", a "selector" or both`);
    if (typeof r.reason !== 'string' || !r.reason.trim()) usage(`Config ${file}: ignore[${i}] needs a "reason"; an accepted finding must say why`);
  });
  return { file, ignore: ignore.map((r) => ({ check: r.check || null, selector: r.selector || null, reason: r.reason.trim() })) };
}

// ---------------------------------------------------------------- compare mode
// A finding stands for one or more (viewport, element) pairs. Both files are expanded to those pairs, so a
// group of fields matches the separate findings of an older file.
// Small text is one finding per viewport in every version, keyed by viewport and kind.
function expand(findings) {
  const out = [];
  for (const f of findings || []) {
    for (const v of [f.viewport]) {
      if (f.check === 'text-size') { out.push({ k: `${v}|text-size|${f.severity === 'info' ? 'eyebrow' : 'small'}`, f, v }); continue; }
      for (const m of f.members || [f]) out.push({ k: `${v}|${f.check}|${m.anchor || m.selector}`, f, v });
    }
  }
  return out;
}
function compare(beforeFile, afterFile) {
  const a = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const b = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  // Key on a stable anchor (id, name, aria-label, placeholder) when the element has one, so inserting a
  // sibling during a fix does not shift nth-of-type indexes and turn an unchanged finding into a "new" one.
  const byKey = (list) => new Map(expand(list).map((e) => [e.k, e]));
  const before = byKey(a.findings); const after = byKey(b.findings);
  // Findings the project config accepted are neither fixed nor remaining; list them on their own.
  const acceptedAfter = byKey(b.accepted);
  // one line per finding and viewport, however many elements it groups
  const once = (list) => { const seen = new Set(); return list.filter((e) => { const id = `${e.v}\u0000${e.f.check}\u0000${e.f.selector}\u0000${e.f.message}`; if (seen.has(id)) return false; seen.add(id); return true; }); };
  const fixed = once([...before.values()].filter((e) => !after.has(e.k) && !acceptedAfter.has(e.k)));
  const remaining = once([...after.values()].filter((e) => before.has(e.k)));
  const added = once([...after.values()].filter((e) => !before.has(e.k)));
  const accepted = once([...acceptedAfter.values()]);
  // New copy: anything visible after that was not visible before. A digit outside [brackets] is a number
  // the original screen never stated, which the skill forbids unless it is a placeholder for the owner.
  const oldCopy = new Set(a.copy || []);
  const newCopy = (b.copy || []).filter((t) => !oldCopy.has(t));
  const unbracketed = newCopy.filter((t) => /\d/.test(t.replace(/\[[^\]]*\]/g, '')));
  const line = (e) => `  [${e.f.severity}] ${e.v} ${e.f.check} — ${safe(e.f.message)}`;
  console.log(`Fixed ${fixed.length} · remaining ${remaining.length} · new ${added.length}${accepted.length ? ` · accepted ${accepted.length}` : ''}`);
  if (fixed.length) console.log('Fixed:\n' + fixed.map(line).join('\n'));
  if (remaining.length) console.log('Remaining:\n' + remaining.map(line).join('\n'));
  if (added.length) console.log('New (regressions):\n' + added.map(line).join('\n'));
  if (accepted.length) console.log('Accepted (project config):\n' + accepted.map((e) => `${line(e)} — ${safe(e.f.reason)}`).join('\n'));
  if (newCopy.length) console.log('New copy for the owner to review:\n' + newCopy.map((t) => `  "${safe(t)}"`).join('\n'));
  if (unbracketed.length) console.log('[error] invented-number: new copy contains numbers outside [brackets]:\n' + unbracketed.map((t) => `  "${safe(t)}"`).join('\n'));
  process.exit(unbracketed.length || added.some((e) => e.f.severity === 'error') || remaining.some((e) => e.f.severity === 'error') ? 1 : 0);
}

// ---------------------------------------------------------------- in-page measurement
// Runs inside the page; must be self-contained.
function measureInPage({ scopeSel, primarySel, TH, skipChecks, ignore }) {
  const vw = innerWidth; const vh = innerHeight;
  const scoped = scopeSel && document.querySelector(scopeSel);
  const scope = scoped || document.querySelector('main') || document.body;
  const scopeUsed = scoped ? scopeSel : scope === document.body ? 'body' : 'main';
  const findings = []; const accepted = []; const configErrors = [];
  const skip = new Set(skipChecks || []);
  const rules = ignore || [];
  const matches = (el, s) => {
    try { return !!(el && el.nodeType === 1 && el.closest(s)); } catch { if (!configErrors.includes(s)) configErrors.push(s); return false; }
  };
  // An accepted decision matches a finding on its check and on its element (or an ancestor of it).
  const ruleFor = (check, el) => rules.find((r) => (!r.check || r.check === check) && (!r.selector || matches(el, r.selector))) || null;
  const add = (check, severity, el, message, measured, expected, extra = {}) => {
    if (skip.has(check)) return;
    const { rule: forced, ...rest } = extra;
    const rule = 'rule' in extra ? forced : ruleFor(check, el);
    const f = { check, severity, selector: sel(el), anchor: anchor(el), message, measured, expected, ...rest };
    if (rule) accepted.push({ ...f, reason: rule.reason, rule: { check: rule.check, selector: rule.selector } });
    else findings.push(f);
  };
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
  // In the DOM for assistive tech or bots but not on screen: sr-only text, honeypot fields, off-screen and
  // aria-hidden content. visible() passes these (they have a size), so the checks about what a person sees
  // or taps also skip them.
  const hiddenCache = new Map();
  const isVisuallyHidden = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (hiddenCache.has(el)) return hiddenCache.get(el);
    let hidden = !!el.closest('[aria-hidden="true"]');
    if (!hidden) {
      const r = el.getBoundingClientRect();
      // entirely left of or above the page, or right of a page that cannot scroll that far
      hidden = r.right <= 0 || r.bottom + scrollY <= 0 || r.left >= Math.max(vw, document.documentElement.scrollWidth);
    }
    const probe = el.getAttribute('tabindex') === '-1';
    for (let e = el; !hidden && e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e); const er = e.getBoundingClientRect();
      const tiny = er.width <= 1 && er.height <= 1;
      const clipZero = /^rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)$/.test(cs.clip);
      const insetHalf = /inset\(\s*50%/.test(cs.clipPath);
      // sr-only / visually-hidden: clipped to nothing, or clipped and at most 1px
      if (clipZero || insetHalf || (tiny && (/^rect\(/.test(cs.clip) || cs.clipPath !== 'none'))) hidden = true;
      // a tabindex="-1" control inside a zero-size clipping wrapper: the usual honeypot
      else if (probe && e !== el && /hidden|clip/.test(cs.overflow) && (er.width < 1 || er.height < 1)) hidden = true;
    }
    hiddenCache.set(el, hidden);
    return hidden;
  };
  const shown = (el) => visible(el) && !isVisuallyHidden(el);
  // Several elements with one cause (same style, same measurement) are one finding: a count, up to
  // TH.examples example selectors, and every member so nothing is lost.
  const members = (els) => ({ count: els.length, examples: els.slice(0, TH.examples).map(sel), members: els.map((e) => ({ selector: sel(e), anchor: anchor(e) })) });
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom + scrollY) }; };
  const textInputSel = 'input:not([type]), input[type="text"], input[type="number"], input[type="email"], input[type="tel"], input[type="search"], input[type="password"], input[type="url"], input[type="date"], select, textarea';
  const fields = [...scope.querySelectorAll(textInputSel)].filter(shown);

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
  // A link is inline (exempt under WCAG 2.5.8) when it sits in running text: inside a paragraph or list item,
  // or when its parent (or the nearest inline ancestor with text) has words of its own around the link.
  const hasOwnWords = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent));
  const inSentence = (a) => {
    for (let p = a.parentElement, depth = 0; p && depth < 3; p = p.parentElement, depth++) {
      if (hasOwnWords(p)) return true;
      if (!getComputedStyle(p).display.startsWith('inline')) return false;
    }
    return false;
  };
  const minSide = (b) => Math.min(b.r - b.l, b.b - b.t);
  const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const union = (a, b) => ({ l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) });
  const controls = [...scope.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary')].filter(shown);
  const tapGroups = new Map();
  for (const c of controls) {
    if (c.type === 'hidden') continue;
    const r = c.getBoundingClientRect();
    const inline = c.tagName === 'A' && getComputedStyle(c).display === 'inline' && (c.closest('p, li') || inSentence(c));
    if (inline) continue;
    // A checkbox or radio is also hit through its label: the effective target is the control plus a label
    // that wraps it or sits right next to it.
    let target = box(r); let via = null;
    if (c.tagName === 'INPUT' && (c.type === 'checkbox' || c.type === 'radio')) {
      for (const lab of c.labels || []) {
        if (!visible(lab)) continue;
        const lr = lab.getBoundingClientRect();
        const gap = Math.max(lr.left - r.right, r.left - lr.right, lr.top - r.bottom, r.top - lr.bottom, 0);
        if (!lab.contains(c) && gap > TH.labelGapPx) continue;
        const u = union(target, box(lr));
        if (minSide(u) > minSide(target)) { target = u; via = lab; }
      }
    }
    const side = minSide(target); const w = Math.round(target.r - target.l); const h = Math.round(target.b - target.t);
    if (side >= TH.tapPx || vw > 480) continue;
    const msg = via ? `Tap target is ${Math.round(r.width)}×${Math.round(r.height)}px; its label extends it to ${w}×${h}px` : `Tap target is ${w}×${h}px`;
    // controls with the same tag, type and classes and the same short side are one finding
    const style = `${c.tagName.toLowerCase()}${c.tagName === 'INPUT' ? `[type="${c.type}"]` : ''}${[...c.classList].map((x) => `.${x}`).join('')}`;
    const severity = side < TH.tapErrorPx ? 'error' : 'warn'; const rule = ruleFor('tap-target', c);
    const k = [style, Math.round(side), severity, via ? 1 : 0, rules.indexOf(rule)].join('|');
    const g = tapGroups.get(k) || { style, severity, rule, side: Math.round(side), items: [] };
    g.items.push({ c, msg, w, h, via }); tapGroups.set(k, g);
  }
  for (const g of tapGroups.values()) {
    const [first] = g.items;
    const extra = first.via ? { effective: { w: first.w, h: first.h }, label: sel(first.via) } : {};
    if (g.items.length === 1) { add('tap-target', g.severity, first.c, first.msg, g.side, `>= ${TH.tapPx}px`, { rule: g.rule, ...extra }); continue; }
    const short = g.style.split('.').slice(0, 3).join('.');
    add('tap-target', g.severity, first.c, `${g.items.length} controls styled ${short} have tap targets ${g.side}px on the smaller side (the first is ${first.w}×${first.h}px${first.via ? ', label included' : ''})`, g.side, `>= ${TH.tapPx}px`, { rule: g.rule, anchor: `tap-target:${g.style}:${g.side}px`, ...extra, ...members(g.items.map((i) => i.c)) });
  }
  // fields that share a font size below 16px are one finding
  if (vw <= 480) {
    const bySize = new Map();
    for (const f of fields) {
      const fs = parseFloat(getComputedStyle(f).fontSize);
      if (fs >= TH.inputFontPx) continue;
      const rule = ruleFor('input-font-size', f); const k = `${fs}|${rules.indexOf(rule)}`;
      const g = bySize.get(k) || { fs, rule, els: [] }; g.els.push(f); bySize.set(k, g);
    }
    for (const g of bySize.values()) {
      if (g.els.length === 1) add('input-font-size', 'warn', g.els[0], `Field text is ${g.fs}px; iOS zooms the page on focus below 16px`, g.fs, `>= ${TH.inputFontPx}px`, { rule: g.rule });
      else add('input-font-size', 'warn', g.els[0], `${g.els.length} fields use ${g.fs}px text; iOS zooms the page on focus below 16px`, g.fs, `>= ${TH.inputFontPx}px`, { rule: g.rule, anchor: `input-font-size:${g.fs}px`, ...members(g.els) });
    }
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
  // Small text is one finding per viewport, broken down into groups by size and style token. The token is the
  // nearest class that names a size or text role (text-small, caption, eyebrow, text-[12px]), else the tag.
  // Eyebrow labels get their own info finding; groups an accepted decision covers go to accepted.
  const sizeish = (c) => /(^|[-_])(small|smaller|tiny|micro|mini|caption|eyebrow|kicker|overline|meta|hint|helper|help|footnote|fine|legal|label|badge|tag|chip|note)([-_]|$)/i.test(c) || /^(text|font)-(2xs|xs|sm)$/.test(c) || /^(text|font|fs|type)-\[?\d/.test(c) || /^text-\[/.test(c);
  const styleToken = (el) => {
    for (let e = el, i = 0; e && e !== scope.parentElement && i < 4; e = e.parentElement, i++) {
      const c = [...(e.classList || [])].find(sizeish); if (c) return `.${c}`;
    }
    return el.tagName.toLowerCase();
  };
  const sizes = new Map(); const seenContrast = new Set(); const smallGroups = new Map();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; const s = t.textContent.trim(); if (s.length < 2) continue;
    const el = t.parentElement; if (!el || !visible(el) || isVisuallyHidden(el)) continue;
    const cs = getComputedStyle(el); const fsz = parseFloat(cs.fontSize);
    sizes.set(Math.round(fsz), (sizes.get(Math.round(fsz)) || 0) + 1);
    if (fsz < TH.textPx) {
      // eyebrow / kicker: a short uppercase letter-spaced label, small on purpose
      const words = s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
      const tracking = (parseFloat(cs.letterSpacing) || 0) / fsz;
      const upper = cs.textTransform === 'uppercase' || s === s.toUpperCase(); // no lower-case letters on screen
      const eyebrow = words.length <= TH.eyebrowMaxWords && upper && tracking >= TH.eyebrowTrackingEm;
      const rule = ruleFor('text-size', el);
      const token = styleToken(el);
      const k = [Math.round(fsz), token, eyebrow, rules.indexOf(rule)].join('|');
      const g = smallGroups.get(k) || { size: Math.round(fsz), token, eyebrow, rule, els: [], count: 0 };
      g.count++; if (!g.els.includes(el)) g.els.push(el);
      smallGroups.set(k, g);
    }
    const fg = (cs.color.match(/rgba?\(([^)]+)\)/) || [])[1]; const bg = bgOf(el);
    if (fg && bg) {
      const c = ratio(fg.split(',').slice(0, 3).map(Number), bg);
      const large = fsz >= 24 || (fsz >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? TH.contrastLarge : TH.contrast;
      const k = sel(el);
      if (c < need && !seenContrast.has(k)) { seenContrast.add(k); add('contrast', 'error', el, `Text "${s.slice(0, 30)}" has contrast ${c.toFixed(2)}:1`, +c.toFixed(2), `>= ${need}:1`); }
    }
  }
  const buckets = new Map();
  for (const g of [...smallGroups.values()].sort((a, b) => b.count - a.count || b.size - a.size)) {
    const k = `${g.eyebrow}|${rules.indexOf(g.rule)}`;
    const b = buckets.get(k) || { eyebrow: g.eyebrow, rule: g.rule, groups: [] }; b.groups.push(g); buckets.set(k, b);
  }
  for (const b of buckets.values()) {
    const total = b.groups.reduce((n, g) => n + g.count, 0);
    const list = b.groups.map((g) => `${g.size}px × ${g.count} (${g.token})`).join(', ');
    const runs = `${total} text run${total === 1 ? '' : 's'}`;
    const message = b.eyebrow ? `${runs} in short uppercase letter-spaced labels (eyebrow pattern, small by design): ${list}` : `${runs} below ${TH.textPx}px: ${list}`;
    const groups = b.groups.map((g) => ({ size: g.size, signature: g.token, count: g.count, examples: [...new Set(g.els.map(sel))].slice(0, TH.examples), ...(g.eyebrow ? { eyebrow: true } : {}) }));
    add('text-size', b.eyebrow ? 'info' : 'warn', b.groups[0].els[0], message, total, `0 below ${TH.textPx}px`, { rule: b.rule, anchor: `text-size:${b.eyebrow ? 'eyebrow' : 'small'}`, count: total, groups });
  }
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
  const headSel = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
  const heads = [...scope.querySelectorAll(headSel)].filter(visible);
  if (!heads.length) {
    // A scope narrower than main (a form, a card) is often introduced by a heading just outside it: one that
    // labels it through aria-labelledby, or the nearest heading before it within one screen height.
    let outside = null; let how = '';
    for (let e = scope; !outside && e && e !== document.body; e = e.parentElement) {
      for (const id of (e.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)) {
        const t = document.getElementById(id);
        const h = t && (t.matches(headSel) ? t : t.querySelector(headSel));
        if (h && visible(h)) { outside = h; how = 'labels it through aria-labelledby'; break; }
      }
    }
    if (!outside && !scope.matches('main, body')) {
      const before = [...document.querySelectorAll(headSel)].filter((h) => visible(h) && !scope.contains(h) && (h.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING)).pop();
      if (before) {
        const gap = scope.getBoundingClientRect().top - before.getBoundingClientRect().bottom;
        if (gap <= vh) { outside = before; how = gap > 0 ? `sits ${Math.round(gap)}px above it` : 'sits beside it'; }
      }
    }
    if (outside) add('heading', 'info', scope, `Heading is outside the scope: "${outside.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)}" ${how}`, 0, '>= 1', { heading: sel(outside) });
    else add('heading', 'warn', scope, 'No visible heading in the content; the question is not in the heading outline', 0, '>= 1');
  }
  const primary = (primarySel && document.querySelector(primarySel)) || [...scope.querySelectorAll('button[type="submit"], button, [role="button"]')].filter(shown).sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
  if (primary && fields.length) {
    const lastField = fields.reduce((m, f) => (f.getBoundingClientRect().bottom > m.getBoundingClientRect().bottom ? f : m));
    const pr = primary.getBoundingClientRect(); const lf = lastField.getBoundingClientRect();
    const gap = pr.top - lf.bottom;
    if (gap > TH.actionGapVh * vh) add('action-distance', 'warn', primary, `The primary action is ${Math.round(gap)}px below the last field`, Math.round(gap), `<= ${Math.round(TH.actionGapVh * vh)}px`);
    if (pr.bottom > vh && gap > 0 && lf.bottom < vh) add('action-below-fold', 'error', primary, 'The primary action is below the first screen while the fields fit on it', Math.round(pr.bottom), `<= ${vh}px`);
    // largest empty band between content blocks above the action
    const blocks = [...scope.querySelectorAll('h1,h2,h3,p,label,legend,input,select,textarea,button,a,img,svg')].filter(shown).map((e) => e.getBoundingClientRect()).filter((r) => r.bottom <= pr.top + 1).sort((a, b) => a.top - b.top);
    let maxGap = 0; let bottom = blocks.length ? blocks[0].bottom : 0;
    for (const r of blocks) { if (r.top - bottom > maxGap) maxGap = r.top - bottom; bottom = Math.max(bottom, r.bottom); }
    if (pr.top - bottom > maxGap) maxGap = pr.top - bottom;
    if (maxGap > TH.deadSpaceVh * vh) add('dead-space', 'warn', primary, `An empty band of ${Math.round(maxGap)}px sits inside the content above the primary action`, Math.round(maxGap), `<= ${Math.round(TH.deadSpaceVh * vh)}px`);
  }

  // visible copy, for the compare step's new-copy review
  const copy = []; const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const t = tw.currentNode.textContent.replace(/\s+/g, ' ').trim(); const el = tw.currentNode.parentElement; if (t && el && shown(el) && !copy.includes(t)) copy.push(t); }
  for (const el of scope.querySelectorAll('[placeholder], [aria-label]')) {
    if (isVisuallyHidden(el)) continue;
    for (const a of ['placeholder', 'aria-label']) { const v = (el.getAttribute(a) || '').trim(); if (v && !copy.includes(v)) copy.push(v); }
  }
  return { viewport: { width: vw, height: vh }, scope: scopeUsed, fieldCount: fields.length, rows: rows.map((r) => r.items.map((it) => ({ x: it.x, w: it.w }))), copy, findings, accepted, configErrors };
}

// Hides overlays (cookie banners, chat launchers) with an injected style. Runs inside the page.
function hideInPage(selectors) {
  try { document.querySelectorAll(selectors); } catch (e) { return { error: e.message }; }
  const style = document.createElement('style');
  style.setAttribute('data-ui-polish-hide', '');
  style.textContent = `${selectors} { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);
  return { matched: document.querySelectorAll(selectors).length };
}

// ---------------------------------------------------------------- one target
async function measureTarget(browser, target, out, o) {
  const url = /^https?:\/\//.test(target) ? target : require('url').pathToFileURL(path.resolve(target)).href;
  fs.mkdirSync(out, { recursive: true });
  const result = { target, measuredAt: new Date().toISOString(), thresholds: TH, profile: o.profile, viewports: {}, findings: [] };
  if (o.hide) result.hidden = { selectors: o.hide, matched: 0 };
  if (o.config.file) result.config = o.config.file;
  const accepted = []; const configErrors = new Set();
  for (const v of o.viewports) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[v], javaScriptEnabled: o.js, deviceScaleFactor: 1 });
    try {
      if (o.offline || o.assetsOnly) {
        await ctx.route('**/*', (r) => {
          const q = r.request(); const u = q.url();
          if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
          if (q.isNavigationRequest() && !q.frame().parentFrame()) return r.continue(); // the target page itself, including redirects
          return o.assetsOnly && ['font', 'stylesheet', 'image'].includes(q.resourceType()) ? r.continue() : r.abort();
        });
      }
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(600);
      if (o.hide) {
        const h = await page.evaluate(hideInPage, o.hide);
        if (h.error) throw new UsageError(`--hide "${o.hide}" is not a valid selector list: ${h.error}`);
        result.hidden.matched = Math.max(result.hidden.matched, h.matched);
      }
      const r = await page.evaluate(measureInPage, { scopeSel: o.scope, primarySel: o.primary, TH, skipChecks: PROFILES[o.profile], ignore: o.config.ignore });
      await page.screenshot({ path: path.join(out, `${v}.png`) });
      // The viewport shot shows only the first screen; also capture the whole scope element.
      const vr = { fieldCount: r.fieldCount, rows: r.rows, scope: r.scope };
      try {
        await page.locator(r.scope).first().screenshot({ path: path.join(out, `${v}-scope.png`), timeout: 15000 });
        vr.scopeScreenshot = `${v}-scope.png`;
      } catch (e) { vr.scopeScreenshotError = e.message.split('\n')[0]; }
      result.viewports[v] = vr;
      result.copy = [...new Set([...(result.copy || []), ...r.copy])];
      for (const f of r.findings) result.findings.push({ viewport: v, ...f });
      for (const f of r.accepted) accepted.push({ viewport: v, ...f });
      r.configErrors.forEach((s) => configErrors.add(s));
    } finally { await ctx.close(); }
  }
  if (o.config.ignore.length) result.accepted = accepted;
  if (configErrors.size) result.configErrors = [...configErrors];
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(result, null, 2));
  return result;
}

const count = (res, s) => res.findings.filter((f) => f.severity === s).length;
function printResult(res, out) {
  const acc = res.accepted || [];
  console.log(`${res.target}\n${count(res, 'error')} errors · ${count(res, 'warn')} warnings · ${count(res, 'info')} info${acc.length ? ` · ${acc.length} accepted` : ''}  →  ${path.join(out, 'measure.json')}`);
  for (const f of res.findings) console.log(`  [${f.severity}] ${f.viewport} ${f.check}: ${safe(f.message)}${f.selector ? `  (${safe(f.selector)})` : ''}${f.examples && f.examples.length > 1 ? `  also ${f.examples.slice(1).map(safe).join(', ')}` : ''}`);
  if (acc.length) {
    console.log('Accepted (project config):');
    for (const f of acc) console.log(`  [${f.severity}] ${f.viewport} ${f.check}: ${safe(f.message)} — ${safe(f.reason)}`);
  }
  if (res.configErrors) console.log(`Config selectors that are not valid CSS (never matched): ${res.configErrors.map(safe).join(', ')}`);
  for (const [v, vr] of Object.entries(res.viewports)) if (vr.scopeScreenshotError) console.log(`  (no ${v}-scope.png: ${safe(vr.scopeScreenshotError)})`);
}

// ---------------------------------------------------------------- several targets: slugs and roll-up
function slugFor(target, taken) {
  let s;
  if (/^https?:\/\//.test(target)) { const u = new URL(target); s = (u.pathname + u.search).replace(/^\/+|\/+$/g, '') || 'index'; } else s = path.basename(target).replace(/\.[^.]+$/, '');
  s = s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80) || 'page';
  let slug = s; for (let i = 2; taken.has(slug); i++) slug = `${s}-${i}`;
  taken.add(slug);
  return slug;
}
// The same finding on several pages: same check, same element shape (indexes dropped), same message with
// numbers and quoted text blanked.
const signature = (f) => (f.count > 1 && f.anchor ? f.anchor : (f.selector || '').replace(/:nth-of-type\(\d+\)/g, ''));
const template = (m) => String(m).replace(/"[^"]*"/g, '"…"').replace(/\d+(\.\d+)?/g, 'N');
const RANK = { error: 3, warn: 2, info: 1 };
function rollUp(runs) {
  const merged = new Map();
  for (const run of runs) {
    for (const f of run.result ? run.result.findings : []) {
      // small text merges per style group, so one token used on every page is one line
      const parts = f.check === 'text-size' && f.groups
        ? f.groups.map((g) => ({ sig: `${g.size}px ${g.signature}${g.eyebrow ? ' eyebrow' : ''}`, message: `${g.size}px × ${g.count} text run${g.count === 1 ? '' : 's'} (${g.signature})${g.eyebrow ? ' in eyebrow labels' : ` below ${TH.textPx}px`}` }))
        : [{ sig: signature(f), message: f.message }];
      for (const part of parts) {
        const k = `${f.check}|${part.sig}|${template(part.message)}`;
        const m = merged.get(k) || { check: f.check, severity: f.severity, signature: part.sig, template: template(part.message), example: part.message, pages: [], viewports: [], count: 0 };
        if (RANK[f.severity] > RANK[m.severity]) m.severity = f.severity;
        if (!m.pages.includes(run.slug)) m.pages.push(run.slug);
        if (!m.viewports.includes(f.viewport)) m.viewports.push(f.viewport);
        m.count++;
        merged.set(k, m);
      }
    }
  }
  return [...merged.values()].sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.pages.length - a.pages.length || b.count - a.count);
}

async function run(browser, targets, out, o) {
  if (targets.length === 1) {
    const res = await measureTarget(browser, targets[0], out, o);
    printResult(res, out);
    return count(res, 'error') ? 1 : 0;
  }
  const taken = new Set(); const runs = [];
  for (const t of targets) {
    const slug = slugFor(t, taken); const dir = path.join(out, slug);
    try { runs.push({ target: t, slug, result: await measureTarget(browser, t, dir, o) }); } catch (e) {
      if (e instanceof UsageError) throw e;
      runs.push({ target: t, slug, error: e.message.split('\n')[0] });
    }
  }
  const merged = rollUp(runs);
  const summary = {
    measuredAt: new Date().toISOString(), profile: o.profile,
    targets: runs.map((r) => ({
      target: r.target, slug: r.slug, measure: r.result ? `${r.slug}/measure.json` : null, error: r.error,
      counts: r.result ? { error: count(r.result, 'error'), warn: count(r.result, 'warn'), info: count(r.result, 'info'), accepted: (r.result.accepted || []).length } : null,
    })),
    merged,
  };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  for (const r of summary.targets) {
    if (r.error) { console.log(`${r.target}\n  run failed: ${safe(r.error)}`); continue; }
    console.log(`${r.target}\n  ${r.counts.error} errors · ${r.counts.warn} warnings · ${r.counts.info} info${r.counts.accepted ? ` · ${r.counts.accepted} accepted` : ''}  →  ${path.join(out, r.measure)}`);
  }
  console.log(`\nAcross ${runs.length} targets: ${merged.length} distinct findings  →  ${path.join(out, 'summary.json')}`);
  for (const m of merged) console.log(`  [${m.severity}] ${m.check}: ${safe(m.example)}${m.signature ? `  (${safe(m.signature)})` : ''} — ${m.pages.length} page${m.pages.length === 1 ? '' : 's'}: ${m.pages.map(safe).join(', ')}`);
  if (runs.some((r) => r.error)) return 3;
  return runs.some((r) => count(r.result, 'error')) ? 1 : 0;
}

// ---------------------------------------------------------------- main
(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--compare') { if (args.length < 3) usage('Missing files to compare'); return compare(args[1], args[2]); }
  const targets = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
  if (!targets.length) usage('Missing <file-or-url>');
  const opt = (n, d) => {
    const i = args.indexOf(`--${n}`); if (i < 0) return d;
    const v = args[i + 1]; if (v === undefined || v.startsWith('--')) usage(`--${n} needs a value`);
    return v;
  };
  const out = path.resolve(opt('out', 'ui-polish-out'));
  const viewports = opt('viewports', 'phone,desktop').split(',').map((v) => v.trim()).filter(Boolean);
  for (const v of viewports) if (!VIEWPORTS[v]) usage(`Unknown viewport "${v}" (use phone, desktop)`);
  const profile = opt('profile', 'form');
  if (!PROFILES[profile]) usage(`Unknown profile "${profile}" (use ${Object.keys(PROFILES).join(', ')})`);
  const hide = (opt('hide', '') || '').trim() || null;
  const o = {
    scope: opt('scope', null), primary: opt('primary', null), js: args.includes('--js'),
    offline: args.includes('--offline'), assetsOnly: args.includes('--assets-only'),
    hide, profile, viewports, config: loadConfig(opt('config', null)),
  };
  const { chromium } = loadPlaywright();
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let code;
  try { code = await run(browser, targets, out, o); } finally { await browser.close(); }
  process.exit(code);
})().catch((e) => {
  if (e instanceof UsageError) { console.error(e.message); process.exit(2); }
  console.error('measure failed:', e.message); process.exit(3);
});
