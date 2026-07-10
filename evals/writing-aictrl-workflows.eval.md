# Eval: writing-aictrl-workflows

A deterministic self-consistency ("golden") check: the bundled worked examples must
validate against the bundled schema, and the skill must contain zero
monorepo-internal anchors. No model output is required — this eval verifies the
artifact is internally consistent and leak-free.

## How to run

From the repo root, with `ajv`, `ajv-formats`, and `js-yaml` available (they are
dev-only; do not add them to this repo — use a scratch `npx`/`node` with them on
`NODE_PATH`, or a temp install outside the repo):

```js
// self-consistency.cjs — validate both examples against the bundled schema
const Ajv = require('ajv/dist/2020');   // Draft 2020-12
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const skill = 'aictrl-skills/skills/writing-aictrl-workflows';
const schema = JSON.parse(fs.readFileSync(path.join(skill, 'reference/workflow.schema.json'), 'utf8'));

// Same AJV configuration the aictrl apply-loader uses for layer-1.
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

let ok = true;
for (const f of ['pr-review-and-triage.yaml', 'review-fix-loop.yaml']) {
  const doc = yaml.load(fs.readFileSync(path.join(skill, 'reference/examples', f), 'utf8'));
  const valid = validate(doc);
  console.log(`${f}: ${valid ? 'VALID' : 'INVALID'}`);
  if (!valid) { console.error(validate.errors); ok = false; }
}
process.exit(ok ? 0 : 1);
```

Leakage grep (from the repo root):

```bash
grep -rEn 'server/|test/|#[0-9]{3,}|/wiki/|applyWorkflowContent|schemas/workflow' \
  aictrl-skills/skills/writing-aictrl-workflows/
```

## Pass criteria (all must hold)

- [ ] `pr-review-and-triage.yaml` validates against the bundled schema (AJV Draft
      2020-12, `strict: false`, `allErrors: true`, `ajv-formats` registered).
- [ ] `review-fix-loop.yaml` validates against the bundled schema with the same
      configuration.
- [ ] The bundled `reference/workflow.schema.json` is validation-equivalent to the
      upstream source commit recorded in `SPEC.md` (the only diff is the three
      sanitized `description` annotation strings; no `pattern`/`enum`/`required`/
      bound/exclusivity change).
- [ ] The leakage grep returns no monorepo-internal anchors — the only acceptable
      match is the schema's public canonical `$id`
      (`https://aictrl.dev/schemas/workflow/v1/...`).
- [ ] `SKILL.md` frontmatter has exactly `name` + `description` (Agent Skills
      standard) and ends with the product-pull attribution block
      (`utm_campaign=writing-aictrl-workflows`).

Record results in `evals/results.md` (date, pass/fail per criterion).
