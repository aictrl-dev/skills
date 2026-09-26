// Shared helpers for the ux-testing scripts: loading Playwright (and js-yaml), the harness token path,
// and the simulator backend (a "System One" model that returns probabilities over choices).
const fs = require('fs');
const os = require('os');
const path = require('path');

// Resolve a package only from the skill's own location (node_modules next to or above the scripts) or from
// NODE_PATH, which the operator sets explicitly. Never from the current directory: the target under test may be
// an untrusted prototype, and a planted node_modules/playwright there would run as you before any page opens.
function requireFrom(name) {
  try { return require(name); } catch (e) {
    if (e && e.code !== 'MODULE_NOT_FOUND') throw e;
    return null;
  }
}

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    const mod = requireFrom(name);
    if (mod) return mod;
  }
  console.error('Playwright was not found next to the skill or on NODE_PATH. Install it in a directory you trust (`npm i -D playwright && npx playwright install chromium`) and run with NODE_PATH=<that directory>/node_modules.');
  process.exit(2);
}

// Reads a task model: JSON always works; YAML needs js-yaml (`npm i -D js-yaml`, or NODE_PATH).
function loadModel(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.json$/i.test(file)) return JSON.parse(text);
  const yaml = requireFrom('js-yaml');
  if (!yaml) {
    console.error(`Reading ${path.basename(file)} needs js-yaml next to the skill or on NODE_PATH (\`npm i -D js-yaml\` in a directory you trust), or write the task model as JSON.`);
    process.exit(2);
  }
  return yaml.load(text);
}

// The per-run access token lives in a private per-user directory; see server.cjs.
function tokenFile(port) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  return path.join(os.tmpdir(), `ux-harness-${uid}`, `${port}.token`);
}

// ---------------------------------------------------------------- simulator backend
// Supported: TypeSafe's Jev (TYPESAFE_API_KEY), or any endpoint with the same request/response contract
// (UX_SIM_ENDPOINT + UX_SIM_API_KEY + UX_SIM_MODEL). Keys are read from the environment only; they are never
// printed, logged, cached or written to disk. The contract is documented in reference/simulator.md.
const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const NOT_CONFIGURED = `Simulator not configured. Simulated users need a fast "System One" model that returns probabilities over choices.
  - TypeSafe Jev: set TYPESAFE_API_KEY (get a key at https://typesafe.ai), or
  - a compatible endpoint: set UX_SIM_ENDPOINT, UX_SIM_API_KEY and UX_SIM_MODEL (contract: reference/simulator.md).
Local models are not supported yet. The simulator is optional: continue with agent testers only.`;

function simBackend() {
  const custom = process.env.UX_SIM_ENDPOINT;
  let endpoint; let key; let model; let label;
  if (custom) {
    endpoint = custom; key = process.env.UX_SIM_API_KEY; model = process.env.UX_SIM_MODEL;
    if (!key || !model) return { error: `UX_SIM_ENDPOINT is set, so UX_SIM_API_KEY and UX_SIM_MODEL are required too.\n${NOT_CONFIGURED}` };
    label = `custom endpoint (${model})`;
  } else if (process.env.TYPESAFE_API_KEY) {
    endpoint = TYPESAFE_ENDPOINT; key = process.env.TYPESAFE_API_KEY; model = process.env.UX_SIM_MODEL || 'jev-latest';
    label = `TypeSafe (${model})`;
  } else return { error: NOT_CONFIGURED };
  let url;
  try { url = new URL(endpoint); } catch { return { error: 'UX_SIM_ENDPOINT is not a valid URL.' }; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return { error: 'UX_SIM_ENDPOINT must use https (plain http is allowed only for localhost), so the key is never sent in clear text.' };
  return { endpoint: url.href, model, label, ask: (state, questions) => ask(url.href, key, model, state, questions) };
}

// Exits (code 2) with the not-configured message when no backend is set up.
function requireSimBackend() {
  const b = simBackend();
  if (b.error) { console.error(b.error); process.exit(2); }
  return b;
}

async function ask(endpoint, key, model, state, questions) {
  let lastStatus = 'no response';
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, state, questions }) });
    } catch (e) {
      lastStatus = `network error: ${e.code || e.name}`;
    }
    if (r && r.ok) return validate(await r.json(), questions);
    if (r) {
      lastStatus = `HTTP ${r.status}`;
      // Auth and request errors will not fix themselves; only retry rate limits and server errors.
      if (r.status !== 429 && r.status < 500) break;
    }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  throw new Error(`simulator request failed (${lastStatus})`);
}

// Checks the response follows the contract, so a drifting endpoint fails loudly instead of skewing results.
function validate(j, questions) {
  const bad = (why) => { throw new Error(`simulator response does not follow the contract: ${why}`); };
  if (!j || typeof j.answers !== 'object' || j.answers === null) bad('missing "answers" object');
  for (const [name, q] of Object.entries(questions)) {
    const a = j.answers[name];
    if (!a) bad(`no answer for "${name}"`);
    if (q.type === 'choice') {
      const p = a.probabilities;
      if (!p || typeof p !== 'object') bad(`"${name}" needs "probabilities"`);
      const keys = Object.keys(p);
      if (!keys.length || keys.some((k) => !(k in q.criteria) || typeof p[k] !== 'number' || p[k] < 0 || p[k] > 1)) bad(`"${name}" probabilities must be numbers in [0, 1] keyed by the criteria`);
      const sum = keys.reduce((s, k) => s + p[k], 0);
      if (Math.abs(sum - 1) > 0.02) bad(`"${name}" probabilities sum to ${sum.toFixed(3)}, not 1`);
    } else if (q.type === 'noul') {
      if (typeof a.noul !== 'number' || a.noul < 0 || a.noul > 1) bad(`"${name}" needs "noul", a number in [0, 1]`);
    }
  }
  return j;
}

// ---------------------------------------------------------------- options and randomness
// Command-line options: `--name value`. A flag given without a value (last argument, or followed by another
// --flag) is a usage error rather than silently becoming undefined/NaN.
function options(argv) {
  const has = (name) => argv.includes(`--${name}`);
  const str = (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    if (i < 0) return dflt;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) usageError(`--${name} needs a value`);
    return v;
  };
  const int = (name, dflt, min) => {
    const raw = str(name, undefined);
    if (raw === undefined) return dflt;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) usageError(`--${name} must be an integer >= ${min} (got "${raw}")`);
    return n;
  };
  return { has, str, int };
}

function usageError(msg) {
  console.error(msg);
  process.exit(2);
}

// mulberry32: a small PRNG on exact 32-bit integer arithmetic (Math.imul, >>> 0), uniform in [0, 1).
// Floating-point LCGs lose low bits once the product passes 2^53 and drift from uniform.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stable 32-bit seed from any parts (e.g. seed, case id, profile, condition, run index), so every simulated
// walk has its own generator and results do not depend on how concurrent workers interleave.
function seedOf(...parts) {
  let h = 2166136261;
  for (const ch of JSON.stringify(parts)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

module.exports = { loadPlaywright, loadModel, tokenFile, simBackend, requireSimBackend, options, rng, seedOf };
