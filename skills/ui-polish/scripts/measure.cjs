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
 * A finding identical on phone and desktop is written once, with "viewports": ["phone", "desktop"].
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
// finding merged across viewports, or a group of fields, matches the separate findings of an older file.
// Small text is one finding per viewport in every version, keyed by viewport and kind.
function expand(findings) {
  const out = [];
  for (const f of findings || []) {
    for (const v of f.viewports || [f.viewport]) {
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
// Runs inside the page through page.evaluate, so everything it uses is defined inside it.
function measureInPage({ scopeSel, primarySel, TH, skipChecks, ignore }) {
  const vw = innerWidth; const vh = innerHeight;
  const scoped = scopeSel && document.querySelector(scopeSel);
  const scope = scoped || document.querySelector('main') || document.body;
  const scopeUsed = scoped ? scopeSel : scope === document.body ? 'body' : 'main';
  const findings = []; const accepted = []; const configErrors = [];
  const skip = new Set(skipChecks || []);
  const rules = ignore || [];

  // ---- findings and accepted decisions
  const matches = (el, s) => {
    try { return !!(el && el.nodeType === 1 && el.closest(s)); } catch {
      if (!configErrors.includes(s)) configErrors.push(s);
      return false;
    }
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
  // Items that share a key, in first-seen order.
  function groupBy(items, keyOf) {
    const groups = new Map();
    for (const it of items) { const k = keyOf(it); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    return [...groups.values()];
  }
  // Several elements with one cause are one finding: a count, up to TH.examples example selectors and every
  // member, so nothing is lost. A group of one keeps the single-element message and shape.
  function emitGroup(check, severity, els, rule, single, many, measured, expected, extra = {}) {
    if (els.length === 1) { add(check, severity, els[0], single, measured, expected, { rule, ...extra.single }); return; }
    add(check, severity, els[0], many, measured, expected, {
      rule, anchor: extra.anchor, ...extra.many,
      count: els.length, examples: els.slice(0, TH.examples).map(sel), members: els.map((e) => ({ selector: sel(e), anchor: anchor(e) })),
    });
  }

  // ---- element helpers
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
      const same = parent ? [...parent.children].filter((c) => c.tagName === e.tagName) : [];
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
      r: Math.round(r.right), b: Math.round(r.bottom + scrollY),
    };
  };
  const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const minSide = (b) => Math.min(b.r - b.l, b.b - b.t);

  // ---- visually hidden: in the DOM for assistive tech or bots, but not on screen
  // Each ancestor's own contribution is computed once (clipped away, or a zero-size clipping box).
  const ownClip = new Map(); const clipUp = new Map(); const zeroUp = new Map();
  function clippedAway(e) {
    if (!ownClip.has(e)) {
      const cs = getComputedStyle(e); const er = e.getBoundingClientRect();
      const tiny = er.width <= 1 && er.height <= 1;
      const clipZero = /^rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)$/.test(cs.clip);
      const insetHalf = /inset\(\s*50%/.test(cs.clipPath);
      // sr-only / visually-hidden: clipped to nothing, or clipped and at most 1px
      ownClip.set(e, clipZero || insetHalf || (tiny && (/^rect\(/.test(cs.clip) || cs.clipPath !== 'none')));
    }
    return ownClip.get(e);
  }
  const zeroClipBox = (e) => {
    const er = e.getBoundingClientRect();
    return /hidden|clip/.test(getComputedStyle(e).overflow) && (er.width < 1 || er.height < 1);
  };
  // memoised walk up the tree: true when e or an ancestor satisfies test
  function upward(cache, test, e) {
    if (!e || e === document.documentElement) return false;
    if (!cache.has(e)) cache.set(e, test(e) || upward(cache, test, e.parentElement));
    return cache.get(e);
  }
  const hiddenCache = new Map();
  function isVisuallyHidden(el) {
    if (!el || el.nodeType !== 1) return false;
    if (hiddenCache.has(el)) return hiddenCache.get(el);
    let hidden = !!el.closest('[aria-hidden="true"]');
    if (!hidden) {
      const r = el.getBoundingClientRect();
      // entirely left of or above the page, or right of a page that cannot scroll that far
      hidden = r.right <= 0 || r.bottom + scrollY <= 0 || r.left >= Math.max(vw, document.documentElement.scrollWidth);
    }
    if (!hidden) hidden = upward(clipUp, clippedAway, el);
    // a tabindex="-1" control inside a zero-size clipping wrapper: the usual honeypot
    if (!hidden && el.getAttribute('tabindex') === '-1') hidden = upward(zeroUp, zeroClipBox, el.parentElement);
    hiddenCache.set(el, hidden);
    return hidden;
  }
  const shown = (el) => visible(el) && !isVisuallyHidden(el);

  const textInputSel = 'input:not([type]), input[type="text"], input[type="number"], input[type="email"], input[type="tel"], '
    + 'input[type="search"], input[type="password"], input[type="url"], input[type="date"], select, textarea';
  const fields = [...scope.querySelectorAll(textInputSel)].filter(shown);
  const rows = [];

  // ---- C1/C2 alignment and equal widths across repeated rows of fields
  function checkFieldRows() {
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
        if (dx <= TH.alignPx) continue;
        add('column-alignment', 'error', b[k].el, `Field ${k + 1} of this row is ${dx}px out of line with the same column in the row above`, dx, `<= ${TH.alignPx}px`);
      }
    }
    // equal widths: compare each field with the same column in the next row of the same shape
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1].items; const b = rows[i].items;
      if (a.length < 2 || a.length !== b.length) continue;
      for (let k = 0; k < a.length; k++) {
        const dw = Math.abs(a[k].w - b[k].w);
        if (dw <= TH.widthPx) continue;
        add('equal-widths', 'warn', b[k].el, `Field ${k + 1} of this row is ${b[k].w}px wide; the same column above is ${a[k].w}px`, dw, `<= ${TH.widthPx}px difference`);
      }
    }
  }

  // ---- C3 field fill on narrow screens
  function checkFieldFill() {
    if (vw > 480) return;
    for (const r of rows) {
      const span = Math.max(...r.items.map((it) => it.r)) - Math.min(...r.items.map((it) => it.x));
      // the column is the nearest block-level ancestor that contains every field of the row
      let col = r.items[0].el.parentElement;
      const holdsRow = (c) => r.items.every((it) => c.contains(it.el)) && !getComputedStyle(c).display.startsWith('inline');
      while (col && col !== document.body && !holdsRow(col)) col = col.parentElement;
      const cs = col ? getComputedStyle(col) : null;
      const colW = col ? col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : vw;
      const ratio = span / colW;
      if (ratio >= TH.fillRatio) continue;
      add('field-fill', 'warn', r.items[0].el, `Fields in this row span ${Math.round(ratio * 100)}% of the column on a ${vw}px screen`, +ratio.toFixed(2), `>= ${TH.fillRatio}`);
    }
  }

  // ---- C4 accessible names and C5 labels placed after the field
  const accName = (el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l.textContent.trim(); }
    const wrap = el.closest('label'); if (wrap) return wrap.textContent.trim();
    return (el.getAttribute('title') || '').trim();
  };
  function checkNamesAndLabels() {
    for (const f of fields) {
      if (!accName(f)) add('accessible-name', 'error', f, 'Field has no accessible name (no <label for>, aria-label or aria-labelledby)', null, 'label');
      const fr = f.getBoundingClientRect();
      const next = f.nextElementSibling;
      if (!next || !visible(next) || next.tagName === 'INPUT') continue;
      const nr = next.getBoundingClientRect();
      const txt = (next.textContent || '').trim();
      if (txt && txt.length <= 24 && nr.left >= fr.right - 2 && Math.abs((nr.top + nr.bottom) / 2 - (fr.top + fr.bottom) / 2) < fr.height / 2) {
        add('label-after-field', 'warn', f, `Label "${txt}" sits after the field; labels read and align better above it`, 'after', 'above');
      }
    }
  }

  // ---- C6 tap targets
  // A link is inline (exempt under WCAG 2.5.8) when it sits in running text: inside a paragraph or list item,
  // or when its parent (or the nearest inline ancestor with text) has words of its own around the link.
  const hasOwnWords = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent));
  function inSentence(a) {
    for (let p = a.parentElement, depth = 0; p && depth < 3; p = p.parentElement, depth++) {
      if (hasOwnWords(p)) return true;
      if (!getComputedStyle(p).display.startsWith('inline')) return false;
    }
    return false;
  }
  const isInlineLink = (c) => c.tagName === 'A' && getComputedStyle(c).display === 'inline' && (c.closest('p, li') || inSentence(c));
  const union = (a, b) => ({ l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) });
  // A checkbox or radio is also hit through its label: the effective target is the control plus a label
  // that wraps it or sits right next to it.
  function tapTarget(c) {
    const r = c.getBoundingClientRect();
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
    const w = Math.round(target.r - target.l); const h = Math.round(target.b - target.t);
    const msg = via ? `Tap target is ${Math.round(r.width)}×${Math.round(r.height)}px; its label extends it to ${w}×${h}px` : `Tap target is ${w}×${h}px`;
    return { c, side: minSide(target), w, h, via, msg };
  }
  function checkTapTargets() {
    if (vw > 480) return;
    const controls = [...scope.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary')].filter(shown);
    const small = controls.filter((c) => c.type !== 'hidden' && !isInlineLink(c)).map(tapTarget).filter((t) => t.side < TH.tapPx).map((t) => ({
      ...t,
      severity: t.side < TH.tapErrorPx ? 'error' : 'warn',
      rule: ruleFor('tap-target', t.c),
      // controls with the same tag, type and classes and the same short side are one finding
      style: `${t.c.tagName.toLowerCase()}${t.c.tagName === 'INPUT' ? `[type="${t.c.type}"]` : ''}${[...t.c.classList].map((x) => `.${x}`).join('')}`,
    }));
    for (const g of groupBy(small, (t) => [t.style, Math.round(t.side), t.severity, t.via ? 1 : 0, rules.indexOf(t.rule)].join('|'))) {
      const [first] = g; const side = Math.round(first.side);
      const labelled = first.via ? { effective: { w: first.w, h: first.h }, label: sel(first.via) } : {};
      const short = first.style.split('.').slice(0, 3).join('.');
      const many = `${g.length} controls styled ${short} have tap targets ${side}px on the smaller side `
        + `(the first is ${first.w}×${first.h}px${first.via ? ', label included' : ''})`;
      emitGroup('tap-target', first.severity, g.map((t) => t.c), first.rule, first.msg, many, side, `>= ${TH.tapPx}px`,
        { anchor: `tap-target:${first.style}:${side}px`, single: labelled, many: labelled });
    }
  }

  // ---- C7 input font size: fields that share a font size below 16px are one finding
  function checkInputFont() {
    if (vw > 480) return;
    const small = fields.map((f) => ({ f, fs: parseFloat(getComputedStyle(f).fontSize) })).filter((x) => x.fs < TH.inputFontPx)
      .map((x) => ({ ...x, rule: ruleFor('input-font-size', x.f) }));
    for (const g of groupBy(small, (x) => `${x.fs}|${rules.indexOf(x.rule)}`)) {
      const { fs, rule } = g[0];
      emitGroup('input-font-size', 'warn', g.map((x) => x.f), rule, `Field text is ${fs}px; iOS zooms the page on focus below 16px`,
        `${g.length} fields use ${fs}px text; iOS zooms the page on focus below 16px`, fs, `>= ${TH.inputFontPx}px`, { anchor: `input-font-size:${fs}px` });
    }
  }

  // ---- C8 text size, C9 contrast, C10 type scale
  // Effective background: collect the background layers from the element up to the first opaque one, then
  // alpha-composite them bottom-up (the canvas is white). Unknown under an image or gradient.
  function bgOf(el) {
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
  }
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // The style token of small text is the nearest class that names a size or text role (text-small, caption,
  // eyebrow, text-[12px]), else the tag.
  const roleWord = /(^|[-_])(small|smaller|tiny|micro|mini|caption|eyebrow|kicker|overline|meta|hint|helper|help|footnote|fine|legal|label|badge|tag|chip|note)([-_]|$)/i;
  const sizeish = (c) => roleWord.test(c)
    || /^(text|font)-(2xs|xs|sm)$/.test(c) || /^(text|font|fs|type)-\[?\d/.test(c) || /^text-\[/.test(c);
  function styleToken(el) {
    for (let e = el, i = 0; e && e !== scope.parentElement && i < 4; e = e.parentElement, i++) {
      const c = [...(e.classList || [])].find(sizeish); if (c) return `.${c}`;
    }
    return el.tagName.toLowerCase();
  }
  // eyebrow / kicker: a short uppercase letter-spaced label, small on purpose
  function isEyebrow(s, cs, fsz) {
    const words = s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    const tracking = (parseFloat(cs.letterSpacing) || 0) / fsz;
    const upper = cs.textTransform === 'uppercase' || s === s.toUpperCase(); // no lower-case letters on screen
    return words.length <= TH.eyebrowMaxWords && upper && tracking >= TH.eyebrowTrackingEm;
  }
  function checkText() {
    const sizes = new Map(); const seenContrast = new Set(); const runs = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const s = walker.currentNode.textContent.trim(); if (s.length < 2) continue;
      const el = walker.currentNode.parentElement; if (!el || !visible(el) || isVisuallyHidden(el)) continue;
      const cs = getComputedStyle(el); const fsz = parseFloat(cs.fontSize);
      sizes.set(Math.round(fsz), (sizes.get(Math.round(fsz)) || 0) + 1);
      if (fsz < TH.textPx) runs.push({ el, size: Math.round(fsz), token: styleToken(el), eyebrow: isEyebrow(s, cs, fsz), rule: ruleFor('text-size', el) });
      const fg = (cs.color.match(/rgba?\(([^)]+)\)/) || [])[1]; const bg = bgOf(el);
      if (!fg || !bg) continue;
      const c = ratio(fg.split(',').slice(0, 3).map(Number), bg);
      const large = fsz >= 24 || (fsz >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? TH.contrastLarge : TH.contrast;
      const k = sel(el);
      if (c >= need || seenContrast.has(k)) continue;
      seenContrast.add(k);
      add('contrast', 'error', el, `Text "${s.slice(0, 30)}" has contrast ${c.toFixed(2)}:1`, +c.toFixed(2), `>= ${need}:1`);
    }
    // Small text is one finding per viewport, broken down into groups by size and style token; eyebrow labels
    // get their own info finding, and groups an accepted decision covers go to accepted.
    const groups = groupBy(runs, (x) => [x.size, x.token, x.eyebrow, rules.indexOf(x.rule)].join('|'))
      .map((g) => ({ ...g[0], count: g.length, els: [...new Set(g.map((x) => x.el))] }))
      .sort((a, b) => b.count - a.count || b.size - a.size);
    for (const bucket of groupBy(groups, (g) => `${g.eyebrow}|${rules.indexOf(g.rule)}`)) {
      const { eyebrow, rule } = bucket[0];
      const total = bucket.reduce((n, g) => n + g.count, 0);
      const list = bucket.map((g) => `${g.size}px × ${g.count} (${g.token})`).join(', ');
      const what = `${total} text run${total === 1 ? '' : 's'}`;
      const message = eyebrow ? `${what} in short uppercase letter-spaced labels (eyebrow pattern, small by design): ${list}`
        : `${what} below ${TH.textPx}px: ${list}`;
      const detail = bucket.map((g) => ({
        size: g.size, signature: g.token, count: g.count, examples: [...new Set(g.els.map(sel))].slice(0, TH.examples), ...(eyebrow ? { eyebrow: true } : {}),
      }));
      add('text-size', eyebrow ? 'info' : 'warn', bucket[0].els[0], message, total, `0 below ${TH.textPx}px`,
        { rule, anchor: `text-size:${eyebrow ? 'eyebrow' : 'small'}`, count: total, groups: detail });
    }
    if (sizes.size <= TH.typeScaleMax) return;
    const used = [...sizes.keys()].sort((a, b) => a - b).join(', ');
    add('type-scale', 'info', scope, `${sizes.size} different font sizes in use (${used}px)`, sizes.size, `<= ${TH.typeScaleMax}`);
  }

  // ---- C11 horizontal overflow
  // Only visible overflow counts: content clipped by an ancestor (overflow hidden/clip/auto/scroll) that
  // itself fits the viewport does not make the page scroll sideways.
  function checkOverflow() {
    const clipped = (e) => {
      for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= vw + 1) return true;
      }
      return false;
    };
    const sticksOut = (e) => visible(e) && e.getBoundingClientRect().right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !clipped(e);
    const over = [...scope.querySelectorAll('*')].filter(sticksOut);
    const outer = over.filter((e) => !over.some((o) => o !== e && o.contains(e)));
    // body overflow propagates to the viewport when html's is visible; a clipping viewport cannot scroll sideways
    const htmlOx = getComputedStyle(document.documentElement).overflowX;
    const vpOverflow = htmlOx !== 'visible' ? htmlOx : getComputedStyle(document.body).overflowX;
    const pageScrolls = !['hidden', 'clip'].includes(vpOverflow) && document.documentElement.scrollWidth > vw + 1;
    if (!pageScrolls && !outer.length) return;
    add('overflow', 'error', outer[0] || document.body, `Content extends past the ${vw}px viewport`, document.documentElement.scrollWidth, `<= ${vw}px`);
  }

  // ---- C12 heading
  const headSel = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
  // A scope narrower than main (a form, a card) is often introduced by a heading just outside it: one that
  // labels it through aria-labelledby, or the nearest heading before it within one screen height.
  function headingOutside() {
    for (let e = scope; e && e !== document.body; e = e.parentElement) {
      for (const id of (e.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)) {
        const t = document.getElementById(id);
        const h = t && (t.matches(headSel) ? t : t.querySelector(headSel));
        if (h && visible(h)) return { h, how: 'labels it through aria-labelledby' };
      }
    }
    if (scope.matches('main, body')) return null;
    const precedes = (h) => visible(h) && !scope.contains(h) && (h.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING);
    const before = [...document.querySelectorAll(headSel)].filter(precedes).pop();
    if (!before) return null;
    const gap = scope.getBoundingClientRect().top - before.getBoundingClientRect().bottom;
    if (gap > vh) return null;
    return { h: before, how: gap > 0 ? `sits ${Math.round(gap)}px above it` : 'sits beside it' };
  }
  function checkHeading() {
    if ([...scope.querySelectorAll(headSel)].some(visible)) return;
    const outside = headingOutside();
    if (outside) {
      const text = outside.h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
      add('heading', 'info', scope, `Heading is outside the scope: "${text}" ${outside.how}`, 0, '>= 1', { heading: sel(outside.h) });
    } else add('heading', 'warn', scope, 'No visible heading in the content; the question is not in the heading outline', 0, '>= 1');
  }

  // ---- C13 dead space and distance to the primary action
  function checkPrimaryAction() {
    const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const primary = (primarySel && document.querySelector(primarySel))
      || [...scope.querySelectorAll('button[type="submit"], button, [role="button"]')].filter(shown).sort((a, b) => area(b) - area(a))[0];
    if (!primary || !fields.length) return;
    const lastField = fields.reduce((m, f) => (f.getBoundingClientRect().bottom > m.getBoundingClientRect().bottom ? f : m));
    const pr = primary.getBoundingClientRect(); const lf = lastField.getBoundingClientRect();
    const gap = pr.top - lf.bottom;
    if (gap > TH.actionGapVh * vh) {
      add('action-distance', 'warn', primary, `The primary action is ${Math.round(gap)}px below the last field`, Math.round(gap), `<= ${Math.round(TH.actionGapVh * vh)}px`);
    }
    if (pr.bottom > vh && gap > 0 && lf.bottom < vh) {
      add('action-below-fold', 'error', primary, 'The primary action is below the first screen while the fields fit on it', Math.round(pr.bottom), `<= ${vh}px`);
    }
    // largest empty band between content blocks above the action
    const blocks = [...scope.querySelectorAll('h1,h2,h3,p,label,legend,input,select,textarea,button,a,img,svg')].filter(shown)
      .map((e) => e.getBoundingClientRect()).filter((r) => r.bottom <= pr.top + 1).sort((a, b) => a.top - b.top);
    let maxGap = 0; let bottom = blocks.length ? blocks[0].bottom : 0;
    for (const r of blocks) { if (r.top - bottom > maxGap) maxGap = r.top - bottom; bottom = Math.max(bottom, r.bottom); }
    if (pr.top - bottom > maxGap) maxGap = pr.top - bottom;
    if (maxGap <= TH.deadSpaceVh * vh) return;
    add('dead-space', 'warn', primary, `An empty band of ${Math.round(maxGap)}px sits inside the content above the primary action`,
      Math.round(maxGap), `<= ${Math.round(TH.deadSpaceVh * vh)}px`);
  }

  // ---- visible copy, for the compare step's new-copy review
  function captureCopy() {
    const copy = []; const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const t = tw.currentNode.textContent.replace(/\s+/g, ' ').trim(); const el = tw.currentNode.parentElement;
      if (t && el && shown(el) && !copy.includes(t)) copy.push(t);
    }
    for (const el of scope.querySelectorAll('[placeholder], [aria-label]')) {
      if (isVisuallyHidden(el)) continue;
      for (const a of ['placeholder', 'aria-label']) { const v = (el.getAttribute(a) || '').trim(); if (v && !copy.includes(v)) copy.push(v); }
    }
    return copy;
  }

  checkFieldRows();
  checkFieldFill();
  checkNamesAndLabels();
  checkTapTargets();
  checkInputFont();
  checkText();
  checkOverflow();
  checkHeading();
  checkPrimaryAction();
  const copy = captureCopy();
  const rowSummary = rows.map((r) => r.items.map((it) => ({ x: it.x, w: it.w })));
  return { viewport: { width: vw, height: vh }, scope: scopeUsed, fieldCount: fields.length, rows: rowSummary, copy, findings, accepted, configErrors };
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
// A finding with the same check, severity, element and message on several viewports is reported once, with
// every viewport in "viewports"; "viewport" stays the first of them for older readers.
function mergeViewports(list) {
  const out = []; const seen = new Map();
  for (const f of list) {
    const k = JSON.stringify([f.check, f.severity, f.selector, f.message]);
    const m = seen.get(k);
    if (m) { if (!m.viewports.includes(f.viewport)) m.viewports.push(f.viewport); continue; }
    const { viewport, ...rest } = f;
    const g = { viewport, viewports: [viewport], ...rest }; seen.set(k, g); out.push(g);
  }
  return out;
}

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
  result.findings = mergeViewports(result.findings);
  if (o.config.ignore.length) result.accepted = mergeViewports(accepted);
  if (configErrors.size) result.configErrors = [...configErrors];
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(result, null, 2));
  return result;
}

const count = (res, s) => res.findings.filter((f) => f.severity === s).length;
function printResult(res, out) {
  const acc = res.accepted || [];
  console.log(`${res.target}\n${count(res, 'error')} errors · ${count(res, 'warn')} warnings · ${count(res, 'info')} info${acc.length ? ` · ${acc.length} accepted` : ''}  →  ${path.join(out, 'measure.json')}`);
  const vps = (f) => (f.viewports || [f.viewport]).join('+');
  for (const f of res.findings) console.log(`  [${f.severity}] ${vps(f)} ${f.check}: ${safe(f.message)}${f.selector ? `  (${safe(f.selector)})` : ''}${f.examples && f.examples.length > 1 ? `  also ${f.examples.slice(1).map(safe).join(', ')}` : ''}`);
  if (acc.length) {
    console.log('Accepted (project config):');
    for (const f of acc) console.log(`  [${f.severity}] ${vps(f)} ${f.check}: ${safe(f.message)} — ${safe(f.reason)}`);
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
        for (const v of f.viewports || [f.viewport]) if (!m.viewports.includes(v)) m.viewports.push(v);
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
