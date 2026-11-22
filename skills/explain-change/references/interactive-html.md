# Interactive HTML export

Use the same verified Markdown as the Markdown deliverable. Create
`steps.json` as an array with one entry per Mermaid fence, in document order.
Pick the steps that teach the change. Use the diagram's IDs and exact
displayed labels, and read each excerpt at the explained revision.

```json
[
  {
    "title": "How a stale job is stopped",
    "steps": [
      {"id": "check", "label": "Check generation", "summary": "Compare the job's generation with the current record."},
      {
        "id": "reject",
        "label": "Ignore stale job",
        "summary": "Return before persisting an update.",
        "outcome": "fail",
        "source": {
          "label": "src/jobs.ts:24–26",
          "url": "https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/src/jobs.ts#L24-L26",
          "code": "if (job.generation !== current.generation) {\n  return;\n}"
        }
      }
    ],
    "traces": [{"label": "Stale job", "steps": ["check", "reject"]}]
  }
]
```

Omit `source` when there is no verified excerpt. Apply the same redaction
review to embedded code as to the explanation. Optional outcomes are
`ok`, `retry`, and `fail`. For a flowchart, add optional ordered traces
only when the source supports each consecutive edge. The viewer offers
an accessible step list even when a drawn label cannot be matched uniquely.
A document without Mermaid fences uses an empty steps array.

Use the installed skill directory and the same pinned `mmdc` as the
Mermaid verification step. The CLI provides the Markdown parser used by
the exporter. When the CLI is installed separately, set `MERMAID_CLI`
to its executable path. If the bundled Chromium cannot use its sandbox,
set `PUPPETEER_EXECUTABLE_PATH` to an installed Chrome that can.

```bash
node "<skill-dir>/scripts/render-interactive.mjs" \
  --input "<scratch>/explainer.md" \
  --steps "<scratch>/steps.json" \
  --output "explain-change.html"
```

Open the resulting file locally. Check that every diagram renders, that
a clicked step and a keyboard-selected step display the expected excerpt
and pinned link, and that any supplied trace highlights the intended
route. Confirm that the HTML loads without network requests. The renderer
embeds the SVG and code, so readers only need a browser. If the renderer
or browser check is unavailable, report the missing prerequisite.
