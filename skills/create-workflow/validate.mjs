#!/usr/bin/env node
/**
 * validate.mjs — offline pre-apply validator for an aictrl workflow file.
 *
 * Runs the SAME layer-1 gate the apply-loader runs (JSON Schema, draft 2020-12,
 * against the bundled reference/workflow.schema.json) PLUS the static DAG checks
 * the schema can't express (duplicate node ids, edge endpoints, acyclicity, loop
 * nesting depth and the nested-maxIterations product bound).
 *
 * What it can NOT check offline (by design):
 *   - whether a `template:` / `workflow:` ref exists in YOUR org — those resolve
 *     org-scoped at apply time (fail-closed), so only the apply / a server
 *     dry-run confirms them.
 *   - CEL semantics of `when`/`until`/`while`/gate conditions (evaluated at run).
 * A green run here means "structurally correct and DAG-sound"; the apply
 * (git-sync of `.aictrl/workflows/<name>.yaml`) is the definitive gate.
 *
 * Usage (run from your repo root):
 *   node path/to/validate.mjs .aictrl/workflows/my-workflow.yaml
 *
 * Deps are dev-only and NOT bundled with the skill (same ones the apply-loader
 * uses for layer-1). If they're missing the script tells you what to install:
 *   npm i -D ajv ajv-formats js-yaml
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(here, 'reference', 'workflow.schema.json');
const V1_SCHEMA_PATH = join(here, 'reference', 'v1', 'workflow.schema.json');

const file = process.argv[2];
if (!file) {
  console.error('usage: node validate.mjs <workflow.yaml|.yml|.json>');
  process.exit(2);
}

// Resolve the (dev-only) parser + validator from the HOST repo's node_modules,
// not this skill directory. Run from your repo root so resolution works.
const hostRequire = createRequire(pathToFileURL(join(process.cwd(), 'package.json')));
let AjvMod, addFormatsMod, yaml;
try {
  AjvMod = hostRequire('ajv/dist/2020.js'); // Draft 2020-12
  yaml = hostRequire('js-yaml');
  try { addFormatsMod = hostRequire('ajv-formats'); } catch { addFormatsMod = null; }
} catch {
  console.error('Missing validator dependencies (dev-only; not bundled with the skill).');
  console.error('Install them in this repo, then re-run from the repo root:');
  console.error('  npm i -D ajv ajv-formats js-yaml');
  process.exit(2);
}
const Ajv = AjvMod.default || AjvMod;
const addFormats = addFormatsMod ? (addFormatsMod.default || addFormatsMod) : null;

// Parse the workflow file (YAML or JSON — the loader accepts both).
let doc;
try {
  const raw = readFileSync(resolve(file), 'utf8');
  // js-yaml v4 `load()` is SAFE by default — it uses DEFAULT_SCHEMA, which has no
  // type-constructing tags (the unsafe loader / `safeLoad` were removed in v4).
  // Workflow files are plain data (maps/lists/scalars); no custom schema is used.
  doc = file.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw);
} catch (e) {
  console.error(`Could not read/parse ${file}: ${e.message}`);
  process.exit(2);
}

const errors = [];

// ---- Layer 1: JSON Schema (identical config to the apply-loader) ------------
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const v1Schema = JSON.parse(readFileSync(V1_SCHEMA_PATH, 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
if (addFormats) addFormats(ajv);
ajv.addSchema(v1Schema);
const validate = ajv.compile(schema);
if (!validate(doc)) {
  for (const e of validate.errors) {
    const params = e.params && Object.keys(e.params).length ? '  ' + JSON.stringify(e.params) : '';
    errors.push(`schema  ${e.instancePath || '/'}  ${e.message}${params}`);
  }
}

// ---- Static DAG checks (semantic; NOT in the schema — mirror validateDag) ----
function hasCycle(ids, edges) {
  const adj = new Map(ids.map((id) => [id, []]));
  for (const e of edges || []) {
    if (e && adj.has(e.from) && adj.has(e.to)) adj.get(e.from).push(e.to);
  }
  const state = new Map(); // 0=unvisited,1=in-stack,2=done
  const dfs = (u) => {
    state.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (state.get(v) === 1) return true;
      if (!state.get(v) && dfs(v)) return true;
    }
    state.set(u, 2);
    return false;
  };
  return ids.some((id) => !state.get(id) && dfs(id));
}

// Returns the worst-case path product of nested maxIterations within `nodes`.
function checkGraph(nodes = [], edges = [], depth = 1, where = 'nodes') {
  if (!Array.isArray(nodes)) return 1;
  const ids = [];
  const seen = new Set();
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || n.id == null) continue;
    if (seen.has(n.id)) errors.push(`dag     ${where}  duplicate node id "${n.id}"`);
    seen.add(n.id);
    ids.push(n.id);
  }
  for (const e of edges || []) {
    if (e?.from != null && !seen.has(e.from)) errors.push(`dag     ${where}  edge.from "${e.from}" is not a node id at this level`);
    if (e?.to != null && !seen.has(e.to)) errors.push(`dag     ${where}  edge.to "${e.to}" is not a node id at this level`);
  }
  if (hasCycle(ids, edges)) errors.push(`dag     ${where}  graph is cyclic (edges must form a DAG)`);

  let worst = 1;
  for (const n of nodes) {
    if (n?.type !== 'loop') continue;
    if (depth >= 3 && n.body) errors.push(`dag     loop "${n.id ?? '?'}"  nesting depth exceeds the max of 3`);
    const childProduct = checkGraph(n.body?.nodes, n.body?.edges, depth + 1, `loop "${n.id ?? '?'}".body`);
    const factor = (typeof n.maxIterations === 'number' ? n.maxIterations : 1) * childProduct;
    if (factor > 1000) errors.push(`dag     loop "${n.id ?? '?'}"  product of nested maxIterations (${factor}) exceeds 1000`);
    worst = Math.max(worst, factor);
  }
  return worst;
}
if (doc && typeof doc === 'object') checkGraph(doc.nodes, doc.edges);

// ---- Report ------------------------------------------------------------------
if (errors.length === 0) {
  console.log(`✓ ${file} — schema-valid (layer 1) and passes static DAG checks.`);
  console.log('  Not checked offline: template:/workflow: refs are resolved org-scoped at APPLY');
  console.log('  time (fail-closed if absent), and CEL semantics are evaluated at run time.');
  console.log('  The apply (git-sync) is the definitive gate.');
  process.exit(0);
}
console.error(`✗ ${file} — ${errors.length} problem(s):`);
for (const e of errors) console.error(`  - ${e}`);
console.error('\nFix these, then re-run. (schema = layer-1 structure; dag = graph/loop semantics)');
process.exit(1);
