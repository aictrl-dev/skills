# Create-workflow authoring fixtures

These five fixtures are behavioral evaluation cases for `create-workflow`.
Give a fresh agent the task in `tasks.md`, the public skill, and the listed
available skill references. Do not show it the matching file under `expected/`.

The expected files are **config shapes**, not byte-for-byte golden output. A
passing agent may choose different labels, descriptions, node IDs, or prompts
when it preserves the required workflow semantics and passes the bundled
validator.

Run each generated file through:

```bash
node skills/create-workflow/validate.mjs .aictrl/workflows/<name>.yaml
```

The evaluator must also check the scenario-specific shape assertions in
`tasks.md`. A structurally valid file still fails when it omits a required
approval gate, uses an unpinned skill, invents an unavailable dependency, or
silently adds deployment/merge behavior.
