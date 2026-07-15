#!/usr/bin/env python3
"""Split the one-shot narration into per-scene clips at paragraph boundaries.

Uses ElevenLabs STT word timestamps (narration-full.stt.json) + difflib fuzzy
alignment between the expected script words and the transcript words. Exact
word matching does NOT work: STT rewrites coined/brand words and loanwords,
so anchor on the fuzzy alignment, not equality.

Each boundary snaps to the largest inter-word pause within +/-1 word of the
aligned position. Wider windows pick intra-sentence pauses (e.g. after a
colon) over the true paragraph pause — that once chopped the first words off
a clip. When the voice barely pauses between paragraphs (40 ms happens), the
snap can still land one word off: VERIFY every clip start by transcription
and nudge the cut manually if needed (cut = midpoint of the correct gap in
the stt.json, then re-cut the two adjacent clips with ffmpeg).

Usage:
  python3 split-narration.py --segments demo/segments.json [--out demo/out/voice]
                             [--timeline-only]

Writes: NN-<slug>.mp3 per segment + timeline.json (boundaries, consumed by
record-demo.cjs). --timeline-only skips the ffmpeg clip cutting (used by the
skill's eval, which runs against a canned stt.json fixture with no audio).
"""
import argparse
import difflib
import json
import re
import subprocess
from pathlib import Path


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--segments", default="demo/segments.json")
    ap.add_argument("--out", default=None)
    ap.add_argument("--timeline-only", action="store_true",
                    help="compute timeline.json without cutting audio clips")
    args = ap.parse_args()

    seg_path = Path(args.segments)
    out = Path(args.out) if args.out else seg_path.parent / "out" / "voice"
    full = out / "narration-full.mp3"
    stt_path = out / "narration-full.stt.json"

    segments = json.loads(seg_path.read_text())
    stt = json.loads(stt_path.read_text())
    twords = [
        {"t": norm(w["text"]), "start": w["start"], "end": w["end"]}
        for w in stt["words"]
        if w["type"] == "word" and norm(w["text"])
    ]

    expected = []  # (norm_word, segment_index, first_of_segment)
    for si, seg in enumerate(segments):
        ws = [norm(w) for w in seg["text"].split() if norm(w)]
        for wi, w in enumerate(ws):
            expected.append((w, si, wi == 0))

    sm = difflib.SequenceMatcher(
        None, [e[0] for e in expected], [t["t"] for t in twords], autojunk=False
    )
    opcodes = sm.get_opcodes()

    def map_idx(ei: int) -> int:
        for tag, i1, i2, j1, j2 in opcodes:
            if i1 <= ei < i2:
                if tag == "equal":
                    return j1 + (ei - i1)
                frac = (ei - i1) / max(1, i2 - i1)
                return min(j1 + round(frac * max(1, j2 - j1)), len(twords) - 1)
        return len(twords) - 1

    boundaries = [0.0]
    for ei, (_, si, first) in enumerate(expected):
        if not first or si == 0:
            continue
        j = map_idx(ei)
        best_j, best_gap = j, -1.0
        for jj in range(max(1, j - 1), min(len(twords), j + 2)):
            gap = twords[jj]["start"] - twords[jj - 1]["end"]
            if gap > best_gap:
                best_gap, best_j = gap, jj
        cut = (twords[best_j - 1]["end"] + twords[best_j]["start"]) / 2
        boundaries.append(cut)

    if args.timeline_only:
        # No audio in play (eval fixtures): total = last word end + a small tail.
        total = round(twords[-1]["end"] + 0.4, 2)
    else:
        total = float(
            subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "csv=p=0", str(full)]
            ).strip()
        )
    boundaries.append(total)

    print("TIMELINE (scene start in full track):")
    timeline = []
    out.mkdir(parents=True, exist_ok=True)
    for i, seg in enumerate(segments):
        s, e = boundaries[i], boundaries[i + 1]
        if not args.timeline_only:
            clip = out / f"{i + 1:02d}-{seg['slug']}.mp3"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(full),
                 "-ss", str(s), "-to", str(e), "-c:a", "libmp3lame", "-b:a", "192k", str(clip)],
                check=True,
            )
        timeline.append({"slug": seg["slug"], "start": round(s, 2), "end": round(e, 2)})
        print(f"  {int(s // 60)}:{s % 60:04.1f}  {seg['slug']}  ({e - s:.1f}s)")
    print(f"\nfull track: {total:.1f}s")

    (out / "timeline.json").write_text(json.dumps(timeline, indent=2, ensure_ascii=False))
    print(f"timeline written: {out / 'timeline.json'}")
    if not args.timeline_only:
        print("\nVERIFY clip starts, e.g.:")
        print(f'  for f in {out}/0*.mp3; do ffmpeg -y -loglevel error -t 4 -i "$f" -c:a libmp3lame /tmp/head.mp3; '
              'curl -s -X POST -H "xi-api-key: $ELEVENLABS_API_KEY" -F model_id=scribe_v1 -F file=@/tmp/head.mp3 '
              '-F language_code=en https://api.elevenlabs.io/v1/speech-to-text | '
              "python3 -c 'import json,sys; print(json.load(sys.stdin)[\"text\"])'; done")


if __name__ == "__main__":
    main()
