"""Count tester commands per session from the harness log.

Usage: python3 summarize.py <actions.jsonl> [session-prefix]
Counts every tester command (snapshot, click, type, select, press, wait, screenshot);
excludes open (session setup, not a tester command) and eval/errors/close (operator-only actions).
Log lines without a session (a malformed client call) are skipped. Malformed log lines are skipped
and counted.
"""
import collections
import json
import statistics
import sys

if len(sys.argv) < 2:
    sys.exit('Usage: python3 summarize.py <actions.jsonl> [session-prefix]')

path = sys.argv[1]
prefix = sys.argv[2] if len(sys.argv) > 2 else ''
counts = collections.Counter()
errors = collections.Counter()
skipped = 0
with open(path) as f:
    for line in f:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            skipped += 1
            continue
        if not isinstance(entry, dict):
            skipped += 1
            continue
        session = entry.get('session')
        if not isinstance(session, str) or not session:
            continue
        if not session.startswith(prefix) or entry.get('action') in ('open', 'eval', 'errors', 'close'):
            continue
        counts[session] += 1
        if not entry.get('ok', True):
            errors[session] += 1

for session in sorted(counts):
    print(f'{session}\t{counts[session]} commands\t{errors[session]} errors')
if counts:
    print(f'median\t{statistics.median(counts.values())}')
if skipped:
    print(f'skipped\t{skipped} malformed log lines')
