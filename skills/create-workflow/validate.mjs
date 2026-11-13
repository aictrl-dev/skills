#!/usr/bin/env node
/**
 * validate.mjs — offline pre-import validator for an aictrl workflow file.
 *
 * Runs the SAME layer-1 gate the git-sync import runs (JSON Schema, draft 2020-12,
 * against the bundled reference/workflow.schema.json) PLUS the static DAG checks
 * the schema can't express (duplicate node ids, edge endpoints, acyclicity, loop
 * nesting depth and the nested-maxIterations product bound).
 *
 * Organization checks run when git sync imports the file:
 * model/template/workflow/skill references, input mappings and conditions,
 * and workflow name ownership. Import does not execute nodes or prove runtime
 * expression results.
 *
 * Usage (run from your repo root):
 *   npx --yes -p ajv@8 -p js-yaml@4 -- node path/to/create-workflow/validate.mjs .aictrl/workflows/my-workflow.yaml
 *
 * Needs only Node and npm; dependencies live in npm's cache, not your repo.
 * Verified npx dependencies take priority; host-repository ajv and js-yaml v4+
 * also work without npx.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { basename, delimiter, dirname, join, resolve, sep } from 'node:path';
import { defaultNpmCache, remediationHint } from './validate-env.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(here, 'reference', 'workflow.schema.json');
const V1_SCHEMA_PATH = join(here, 'reference', 'v1', 'workflow.schema.json');

const file = process.argv[2];
if (!file) {
  console.error('usage: node validate.mjs <workflow.yaml|.yml|.json>');
  process.exit(2);
}

// Prefer pinned npx dependencies. npm exec/npx adds its cached
// node_modules/.bin to PATH, but Node does not use PATH for module resolution.
// Only trust PATH package roots inside npm's npx cache, resolving symlinks
// before checking containment. Other PATH entries must never load modules.
const packageRoots = [];
let npxCache;
try {
  const cache = realpathSync(process.env.npm_config_cache ?? defaultNpmCache());
  const cachedNpx = realpathSync(join(cache, '_npx'));
  if (cachedNpx.startsWith(`${cache}${sep}`)) npxCache = cachedNpx;
} catch {
  // No npx cache exists; existing host dependencies can still work.
}
for (const entry of (process.env.PATH || '').split(delimiter)) {
  if (!npxCache || basename(entry) !== '.bin' || basename(dirname(entry)) !== 'node_modules') continue;
  try {
    const bin = realpathSync(entry);
    const root = realpathSync(resolve(entry, '..', '..'));
    if (bin.startsWith(`${npxCache}${sep}`) && root.startsWith(`${npxCache}${sep}`)) {
      packageRoots.push(root);
    }
  } catch {
    // Ignore missing or unresolvable PATH entries.
  }
}
packageRoots.push(process.cwd());
let AjvMod, yaml, yamlVersion;
for (const root of new Set(packageRoots)) {
  const require = createRequire(pathToFileURL(join(root, 'package.json')));
  try {
    [AjvMod, yaml, yamlVersion] = [require('ajv/dist/2020.js'), require('js-yaml'), require('js-yaml/package.json').version];
  } catch {
    // Fall back to the next verified root, then the host, if resolution failed.
    continue;
  }
  break;
}
if (!AjvMod) {
  console.error('Missing validator dependencies. Run without installing into your repository:');
  console.error(`  ${remediationHint(fileURLToPath(import.meta.url), file)}`);
  process.exit(2);
}
const yamlMajor = Number(yamlVersion?.split('.')[0]);
if (!Number.isInteger(yamlMajor) || yamlMajor < 4) {
  console.error(`Unsupported js-yaml version ${yamlVersion ?? 'unknown'}: js-yaml 4 or newer is required for safe YAML loading.`);
  console.error(`  ${remediationHint(fileURLToPath(import.meta.url), file)}`);
  process.exit(2);
}
const Ajv = AjvMod.default || AjvMod;

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

// ---- Layer 1: JSON Schema (the layer-1 gate the git-sync import runs) --------
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const v1Schema = JSON.parse(readFileSync(V1_SCHEMA_PATH, 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
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
  console.log('  Local validation proves structure and static DAG soundness only.');
  console.log('  Git sync checks model/template/workflow/skill references, input mappings');
  console.log('  and conditions, and workflow name ownership when it imports the file.');
  process.exit(0);
}
console.error(`✗ ${file} — ${errors.length} problem(s):`);
for (const e of errors) console.error(`  - ${e}`);
console.error('\nFix these, then re-run. (schema = layer-1 structure; dag = graph/loop semantics)');
process.exit(1);
