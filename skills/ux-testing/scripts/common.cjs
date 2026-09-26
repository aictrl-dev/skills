// Shared helpers for the ux-testing scripts: loading Playwright (and js-yaml), the harness token path,
// and the simulator backend (a "System One" model that returns probabilities over choices).
const fs = require('fs');
const os = require('os');
const path = require('path');

// Resolve a package from the skill's own location first, then from the current directory, so the
// scripts work when the skill is installed globally and run from a project that has the package.
function requireFrom(name) {
  try { return require(name); } catch { /* try the project */ }
  try { return require(require.resolve(name, { paths: [process.cwd()] })); } catch { /* not found */ }
  return null;
}

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    const mod = requireFrom(name);
    if (mod) return mod;
  }
  console.error('Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium` in the project, or set NODE_PATH to a node_modules that has it.');
  process.exit(2);
}

// Reads a task model: JSON always works; YAML needs js-yaml (`npm i -D js-yaml`, or NODE_PATH).
function loadModel(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.json$/i.test(file)) return JSON.parse(text);
  const yaml = requireFrom('js-yaml');
  if (!yaml) {
    console.error(`Reading ${path.basename(file)} needs js-yaml: run \`npm i -D js-yaml\` in the project, set NODE_PATH, or write the task model as JSON.`);
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

module.exports = { loadPlaywright, loadModel, tokenFile, simBackend, requireSimBackend };
