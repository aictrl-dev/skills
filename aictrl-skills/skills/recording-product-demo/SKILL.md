---
name: recording-product-demo
description: End-to-end pipeline for producing a narrated product demo video from any repo with a web UI — the agent discovers and boots the app locally, preps demo data and auth, writes the narration and a scripted browser journey, records a time-locked Playwright take synced to an ElevenLabs voiceover, assembles a 1080p MP4 with branded title/agenda/end cards, and builds a publish kit (faststart MP4, 720p, poster, SRT captions, embed snippet, optional GCS/S3/YouTube upload). Use when the user says 'record a demo video', 'make a product demo', 'demo video for this app/repo', or wants to re-record an existing demo after UI changes.
version: "1.0.0"
---

# Recording Product Demo

Produce a styled, narrated product demo video for **any repo with a web UI** — entirely from scripts, re-recordable in ~10 minutes of machine time once the narration is locked.

The model: **the agent discovers once, then everything is code.** On the first run you (the agent) work out how to boot the app, what to show, and what to say — and capture all of it into a committed `demo/` directory in the host repo. Re-runs (after any UI change) are fully scripted: `boot → record → assemble → publish`, no improvisation.

## Pipeline Overview

```
Phase 0  Discover & boot    → agent reads the repo, writes demo/boot.sh + demo.config.json, boots, health-checks
Phase 1  Prep               → demo data seeded, auth captured (login.cjs), pages probed (scrape-text.cjs)
Phase 2  Script             → scene table + narration text (demo/segments.json)
Phase 3  Narration          → ONE-SHOT TTS → STT word timestamps → split per scene (timeline.json)
Phase 4  Screen recording   → one continuous Playwright take, time-locked to narration (demo/blocks.cjs)
Phase 5  Cards & assembly   → branded title/agenda/end cards + ffmpeg assembly (assemble.cjs)
Phase 6  Publish            → out/publish kit: faststart MP4, 720p, poster, captions.srt, embed snippet; optional upload
```

Resources in this skill:

| File | Purpose |
|------|---------|
| `scripts/record-demo.cjs` | The recorder FRAMEWORK (time-lock, cursor, glides, anonymisation engine) — loads the journey from `demo/blocks.cjs` |
| `scripts/tts-oneshot.cjs` | One-shot ElevenLabs TTS + STT word timestamps, from `demo/segments.json` |
| `scripts/split-narration.py` | Fuzzy-aligned split of the one-shot into per-scene clips; writes `timeline.json` |
| `scripts/assemble.cjs` | Mux (t0-trim + upscale + narration) → cards concat → verification frame grid, all from metadata |
| `scripts/publish.cjs` | Publish kit (faststart/720p/poster/captions.srt/embed) + optional GCS/S3/YouTube upload |
| `scripts/login.cjs` | One-time interactive login (defeats Google's automation block), saves profile + storage state |
| `scripts/scrape-text.cjs` | Dump rendered page text — find anchor strings, sync live numbers into narration |
| `templates/` | `demo.config.example.json`, `blocks.example.cjs`, `segments.example.json`, neutral `title/agenda/end.html` cards |

What the host repo ends up with (committed, except `out/`):

```
demo/
  demo.config.json   # the contract: app/auth/brand/voice/anonymize/record/publish
  boot.sh            # captured boot recipe — starts app + deps, waits until healthy
  segments.json      # narration, one entry per scene
  blocks.cjs         # the Playwright journey, one block per scene
  cards/             # title/agenda/end HTML, branded from the templates
  out/               # build artifacts — add to .gitignore
```

Prerequisites (check before starting, tell the user what's missing): **ElevenLabs API key** (`ELEVENLABS_API_KEY` — TTS *and* STT are both load-bearing; the word timestamps drive the scene split), **ffmpeg + ffprobe**, **Node 18+ with Playwright + Chromium** (`npm i -D playwright && npx playwright install chromium` in the host repo), **Python 3**.

## Phase 0 — Discover & Boot (agent work, captured as code)

1. Read the repo: README, `package.json` scripts, `docker-compose*.yml`, `Makefile`, `Procfile`. Determine how to start the app and its dependencies locally, which port it serves, and what visible text proves it's up.
2. Write **`demo/boot.sh`**: an idempotent script that starts everything (background-safe), then polls `app.baseUrl + healthPath` until `readyText` appears (with a timeout that fails loudly). This is the captured boot recipe — re-runs never re-derive it.
3. Write **`demo/demo.config.json`** from `templates/demo.config.example.json`. Fill `app`, `brand` (name, primary color, and `pronunciation` — see Phase 2), `voice`, `record`. Leave `anonymize.enabled: false` unless the user wants it.
4. Run `boot.sh`, verify health, and `node scripts/scrape-text.cjs <baseUrl>/...` over the main surfaces to learn the real on-screen strings.
5. **Already-deployed instance?** Set `app.baseUrl` to it and skip boot — everything downstream works identically.

## Phase 1 — Prep (demo data + auth)

1. **Demo data**: a demo over an empty app is dead on arrival. Use the repo's own seeds/fixtures (`npm run seed`, `rails db:seed`, SQL fixtures) or create realistic content through the app/API. Prefer data that tells one coherent story (a project with history beats ten empty stubs).
2. **Auth**:
   - `auth.mode: "none"` — app has no login locally (or a dev bypass). Best case; prefer enabling a dev bypass over recording login flows.
   - `auth.mode: "storageState"` — cookie/localStorage sessions. Capture once: `node scripts/login.cjs --url <loginUrl> --expect "<logged-in-only text>"`.
   - `auth.mode: "profile"` — **SPAs whose auth token lives in IndexedDB (e.g. Firebase) render logged-out from a storageState file**; the recorder must reuse the persistent Chrome profile that login.cjs created, which carries IndexedDB too.
3. login.cjs gotchas (each cost real debugging):
   - `--expect` must be an **authenticated-only** string — logged-out marketing pages often contain the same words as app pages, which makes the capture succeed *before* you log in.
   - Google sign-in blocks plain Playwright browsers ("This browser or app may not be secure"); the script launches real Chrome with the automation fingerprint disabled, which passes.
   - storageState only captures localStorage for origins visited **in that session**; if the app keeps critical state there (selected org/workspace), inject it into the state file afterwards.
4. Always probe before recording: `scrape-text.cjs` with the captured auth — confirm the expected logged-in content renders headless.

## Phase 2 — Script

1. Ask the user: target length (~3 min default), audience, language, which features to show.
2. Write `demo/segments.json` (copy `templates/segments.example.json`): one entry per scene beat, `[{"slug": "hook", "text": "..."}, ...]`. Budget ~150 words/min — and note pacing differs by TTS model (eleven_v3 runs noticeably slower/more expressive than v2 for the same text).
3. Narration rules (these prevent re-recording):
   - Use the product UI's own labels **verbatim** — don't paraphrase what's on screen.
   - **Brand pronunciation**: TTS mangles coined names. Generate once, LISTEN, and if mispronounced write the brand phonetically in `segments.json` (`brand.pronunciation` records the chosen spelling) while cards keep the styled wordmark. Re-check when switching voice or model.
   - De-number drift-prone dashboard figures ("more than fifty…") — live data changes between scripting and recording and will contradict the voiceover. Re-scrape on recording day if exact numbers must stay.
   - Spell out abbreviations you want spoken ("pull request", not "PR"); letter-acronyms ("API", "AI") read fine.
4. Run a copy-review pass (subagent) over the narration before spending TTS credits.

## Phase 3 — Narration

```bash
node scripts/tts-oneshot.cjs --segments demo/segments.json --config demo/demo.config.json
python3 scripts/split-narration.py --segments demo/segments.json
```

- **Why one-shot**: generating clips separately (even with previous/next-text stitching) produces stuttered clip starts. One continuous TTS request has exactly one start; the splitter cuts it at paragraph boundaries using ElevenLabs STT **word-level timestamps** + fuzzy alignment (STT rewrites brand words, so exact matching fails).
- **Verify every clip start by transcription** (the splitter prints the command). Boundary snaps can land one word off when the voice barely pauses between paragraphs (40 ms happens) — nudge the cut at the midpoint of the correct gap in `narration-full.stt.json`.
- **v3 short-prompt instability**: `eleven_v3` can break up/crack on short standalone prompts (card VOs). Fix without dropping to v2: put a throwaway warm-up sentence as segment 0 in the same generation, split it off, discard it.
- `timeline.json` holds the scene boundaries — the recorder reads it directly.

## Phase 4 — Screen Recording

Write **`demo/blocks.cjs`** (copy `templates/blocks.example.cjs`): one block per narration segment, anchored on the real strings you scraped in Phase 0. Then:

```bash
node scripts/record-demo.cjs --config demo/demo.config.json    # ~real-time: 3-min demo = 3-min run
```

Hard-won rules baked into the framework — keep them when writing blocks:
- **Playwright never upscales video** — `recordVideo.size` larger than the viewport letterboxes the content. Record at viewport 1536×864; the 1080p upscale happens in ffmpeg (assemble.cjs).
- **`networkidle` never fires on pages holding an SSE/websocket stream.** Use `domcontentloaded` + explicit element waits.
- The framework sets `page.setDefaultTimeout(6000)` and `glideTo` misses cost ~2s and a WARN — a missing element must never eat 30s of a time-locked take.
- Call `setT0()` exactly when narration should start; **every block ends with `await until(B[i])`**. A take with `WARN: block overran` lines is garbage — tighten and re-run.
- **Anonymisation** (`anonymize` in config, `--no-anon` to disable): rewrites identifying text and swaps operator face avatars/initials live during capture via MutationObserver — the recording is anonymised, the app data untouched.
- The take's `t0` and boundaries land in `out/take-meta.json` — nothing is hand-copied downstream.

## Phase 5 — Cards & Assembly

1. Copy `templates/{title,agenda,end}.html` into `demo/cards/`, set the `BRAND` block (color, wordmark, copy). No invented contact details on the end card — ask the user what to print.
2. Render: `npx playwright screenshot --viewport-size=1920,1080 --wait-for-timeout=1500 file://$PWD/demo/cards/title.html demo/cards/title.png` (repeat for agenda/end).
3. Optional card VOs (with the v3 warm-up trick): `out/voice/welcome.mp3` (spoken welcome over the title card — picked up automatically if present) and `out/voice/intro.mp3` (agenda walkthrough, required unless `--no-cards`).
4. Assemble — one command, everything from metadata:

```bash
node scripts/assemble.cjs --build demo
# → out/main.mp4, out/final.mp4, out/frames/grid.png
```

5. Verify: eyeball `out/frames/grid.png` (every scene on the right page), play the head and tail. **Don't chase a glitch at the very start of playback** — VLC/GNOME Videos stutter the first ~0.5s on file-open; if it's clean after seeking to 0, the file is fine (confirm with `ffmpeg -t 6 -i final.mp4 -af astats -f null -` — flat factor 0 means no dropouts).

## Phase 6 — Publish

```bash
node scripts/publish.cjs --build demo
```

Builds `out/publish/`: faststart `demo.mp4` (upload this to YouTube), `demo-720p.mp4` (self-hosting / LinkedIn native upload), `poster.jpg`, **`captions.srt`** (from the STT timestamps — social feeds autoplay muted, captions are non-negotiable), `embed.html`, and `PUBLISH.md` with channel-specific guidance (incl.: post LinkedIn video natively, never as a YouTube link). If `publish.upload` is configured (`gcs` / `s3` / `youtube` — see PUBLISH.md for the one-time OAuth provisioning), it uploads too.

## Pre-flight Checklist

- [ ] `demo/boot.sh` boots from cold and the health check passes
- [ ] Demo data tells a coherent story; auth probe renders logged-in content headless
- [ ] Narration reviewed: UI labels verbatim, brand pronunciation listened-to, drift-prone numbers removed
- [ ] `demo/segments.json` is the single source of narration text
- [ ] Every narration clip start verified by STT transcription
- [ ] Recorder take has ZERO `WARN` lines
- [ ] Frame grid eyeballed: every scene on the right page
- [ ] `demo/out/` is gitignored; auth state/profile stays in `~/.cache` (never committed)
- [ ] Publish kit built; captions attached wherever the video is uploaded

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=recording-product-demo).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=recording-product-demo)
