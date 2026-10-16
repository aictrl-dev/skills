# Eval: recording-product-demo

The full pipeline needs a live app, an ElevenLabs key, and ffmpeg, so the eval
splits into a deterministic engine check (no network, no API key) and an
agent-level routing check.

## How to run (engine check — deterministic)

From the repo root, with Node 18+, Python 3 and ffmpeg installed:

```bash
SKILL=skills/recording-product-demo
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
    if (!(k in c)) { console.error('missing', k); process.exit(1); }
  if (c.publish.upload !== null) { console.error('template upload must be null'); process.exit(1); }"

# 5. publish entrypoint: isolated media/cloud stubs, no upload credentials needed
node --test test/recording-product-demo-publish-shell.test.mjs

# 6. upload opt-in and fail-fast config checks (stub cloud/media and mock HTTP)
node --test test/recording-product-demo-upload.test.mjs

# 7. trusted dependency loading (stub packages only; no browser or network)
node --test test/recording-product-demo-dependencies.test.mjs
```

## Pass criteria (all must hold)

- [ ] **Timeline golden**: step 1 `diff` is empty — boundaries land at the
      midpoint of the inter-paragraph pauses (2.37s, 4.67s) despite the fixture's
      STT rewriting "Dashboard" as two words ("dash board").
- [ ] **Assembly synthesis**: step 2 output (JSON array of planned commands)
      contains a mux invocation with `-ss 1.5` (t0 head-trim from take-meta),
      `-t 8.34` (narrationEnd + 1.4), and a `crop=1536:864` → `scale=1920:1080`
      filter chain (viewport → output from take-meta).
- [ ] **Syntax**: step 3 exits 0 for every .cjs script and the Python splitter.
- [ ] **Config contract**: step 4 exits 0, including the template's null upload default.
- [ ] **Literal GCS arguments**: step 5 passes — build/destination shell syntax
      cannot execute commands; spaces stay in single arguments; publish-kit
      contents retain their destination layout, including recursive assets;
      `--skip-upload` invokes no cloud command and upload failures exit nonzero.
      Missing cloud executables report spawn errors without null-stderr failures;
      with `--upload`, option-like/bucketless GCS/S3 destinations fail before
      processing, while default and `--skip-upload` runs stay local even with
      invalid destinations.
- [ ] **Explicit upload**: step 6 passes — default and `--skip-upload` stay local
      for every configured provider; `--upload` handles GCS, S3 and mocked YouTube
      with unlisted as the default visibility; invalid config and conflicting
      flags fail before media/network; provider failures exit nonzero.
      Local checks reject IPv4 addresses and selected reserved names while
      preserving S3 access-point aliases, non-IP numeric names and Unicode object
      prefixes. Destination logs escape controls while CLI arguments stay literal.

- [ ] **Trusted dependencies**: step 7 passes for login, scraping and recording:
      planted CWD packages never execute; trusted skill/NODE_PATH installs and
      playwright-core work; broken installs preserve original errors; missing
      packages give actionable trusted setup guidance; usage is validated first for
      login and scraping.

Local checks cover syntax and selected naming restrictions from [S3 naming rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html)
and [GCS naming rules](https://docs.cloud.google.com/storage/docs/buckets#naming).
[S3 access-point aliases](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-naming.html)
are valid data-plane destinations, so alias suffixes are preserved. Providers
remain authoritative for full naming policy, existence and permissions; these
stubbed checks do not establish that any remote destination exists or is writable.

## Agent-level check (one fresh session)

In a fresh Claude Code session inside any small web-app repo:
  `/recording-product-demo`
- [ ] The agent checks prerequisites (ElevenLabs key, ffmpeg, Playwright) before
      doing anything else, and reports what's missing instead of failing midway.
- [ ] Playwright setup and card rendering use a trusted installation. The agent
      acknowledges that vendoring the skill in an untrusted repo is not isolation.
- [ ] Existing boot/journey code and its imports are reviewed before execution;
      the journey is reviewed before receiving an authenticated browser context.
- [ ] Phase 0 produces `demo/boot.sh` + `demo/demo.config.json` (not ad-hoc
      shell history), and the boot script health-checks before returning.
- [ ] The agent does NOT hardcode operator-identifying values into committed
      files (anonymisation map and auth artifacts stay machine-local/configurable).
- [ ] Local demo requests build the publish kit without uploading. The agent
      uses `--upload` only with an authorized destination and visibility, without
      repeating confirmation when the user already authorized them.

Record results in evals/results.md (date, pass/fail per criterion).

## Untrusted page evidence

Run the deterministic scraper regression and fresh-session malicious-page and
benign-label cases in [untrusted-evidence.eval.md](untrusted-evidence.eval.md).
The scraper emits one JSON object per page with `source`, `trust`, `boundary`,
and escaped `text`; consumers should extract `text` as evidence, preserving
literal labels while refusing embedded authority claims. Static tests cover
framing and escaping, not agent compliance.

## Session protection regression (#69)

Run `node --test test/recording-product-demo-sessions.test.mjs`. It uses synthetic
state and a browser stub under umask 000: directory modes before launch, file
modes on the initial write, atomic replacement, shared ancestor preservation,
symlink/foreign-owner rejection, trusted/sticky ancestor checks, restrictive
umasks, existing-file modes, closed-window/unexpected-error distinction, and
primary-error preservation when file or browser cleanup also fails.
POSIX assertions are skipped on Windows; the login helper explicitly rejects
Windows capture rather than claiming mode bits establish ACL protection.
