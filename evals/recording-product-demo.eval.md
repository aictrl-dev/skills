# Eval: recording-product-demo

The full pipeline needs a live app, an ElevenLabs key, and ffmpeg, so the eval
splits into a deterministic engine check (no network, no API key) and an
agent-level routing check.

## How to run (engine check — deterministic)

From the repo root, with Node 18+, Python 3 and ffmpeg installed:

```bash
SKILL=aictrl-skills/skills/recording-product-demo
FIX=evals/fixtures/recording-product-demo
WORK=$(mktemp -d)/demo && mkdir -p $WORK/out/voice
cp $FIX/segments.json $WORK/ && cp $FIX/narration-full.stt.json $WORK/out/voice/
cp $FIX/take-meta.json $WORK/out/take-meta.json

# 1. scene split: fuzzy STT alignment must reproduce the golden timeline
python3 $SKILL/scripts/split-narration.py --segments $WORK/segments.json --timeline-only
diff <(python3 -m json.tool $WORK/out/voice/timeline.json) \
     <(python3 -m json.tool $FIX/timeline.golden.json)

# 2. assembly synthesis: dry-run must derive trim/duration from take-meta
#    (the plan is the single line prefixed DRY-RUN-PLAN)
node $SKILL/scripts/assemble.cjs --build $WORK --no-cards --skip-grid --dry-run | grep '^DRY-RUN-PLAN '

# 3. all scripts parse
for f in $SKILL/scripts/*.cjs; do node --check $f; done
python3 -m py_compile $SKILL/scripts/split-narration.py

# 4. config example is valid JSON with the required top-level keys
node -e "const c=require('./$SKILL/templates/demo.config.example.json');
  for (const k of ['app','auth','brand','voice','record','publish'])
    if (!(k in c)) { console.error('missing', k); process.exit(1); }"
```

## Pass criteria (all must hold)

- [ ] **Timeline golden**: step 1 `diff` is empty — boundaries land at the
      midpoint of the inter-paragraph pauses (2.37s, 4.67s) despite the fixture's
      STT rewriting "Dashboard" as two words ("dash board").
- [ ] **Assembly synthesis**: step 2 output (JSON array of planned commands)
      contains a mux invocation with `-ss 1.5` (t0 head-trim from take-meta),
      `-t 8.34` (narrationEnd + 1.4), and a `crop=1536:864` → `scale=1920:1080`
      filter chain (viewport → output from take-meta).
- [ ] **Syntax**: step 3 exits 0 for all six .cjs scripts and the Python splitter.
- [ ] **Config contract**: step 4 exits 0.

## Agent-level check (one fresh session)

In a fresh Claude Code session inside any small web-app repo:
  `/recording-product-demo`
- [ ] The agent checks prerequisites (ElevenLabs key, ffmpeg, Playwright) before
      doing anything else, and reports what's missing instead of failing midway.
- [ ] Phase 0 produces `demo/boot.sh` + `demo/demo.config.json` (not ad-hoc
      shell history), and the boot script health-checks before returning.
- [ ] The agent does NOT hardcode operator-identifying values into committed
      files (anonymisation map and auth artifacts stay machine-local/configurable).

Record results in evals/results.md (date, pass/fail per criterion).
