"""Score a test round against the task model: success per task and role, and the weighted cost J.

Usage:
  python3 score.py <model.yaml|model.json> <results.json> <actions.jsonl> [--before <scorecard.json>] [--out <scorecard.json>]

results.json maps task id -> session suffix -> 1 (success), 0 (failure) or null (voided run, e.g. a harness
crash), e.g. {"T1": {"t1": 1, "t2": 0, "v1": 1, "c1": 1}}. Sessions are logged as "<task>-<suffix>"
(T1-t1); the suffix's first letter is the tester type (t text, v vision, c control, h hurried).
Commands per session come from the harness log, counted like summarize.py.

  weight = frequency x criticality, normalised to sum 1 over the scored tasks
  cost   = weight x (failure_rate x 10 + median_commands / ideal_steps)
  J      = sum of cost (lower is better)

With --before, prints the change in J and flags any criticality-3 task whose success rate fell:
a variant is accepted only if J improves and no criticality-3 task regresses.
"""
import argparse
import collections
import json
import statistics

FREQ = {'daily': 5, 'weekly': 3, 'monthly': 1}
OPERATOR = ('open', 'eval', 'errors')

ap = argparse.ArgumentParser()
ap.add_argument('model')
ap.add_argument('results')
ap.add_argument('log')
ap.add_argument('--before')
ap.add_argument('--out')
a = ap.parse_args()

with open(a.model) as f:
    if a.model.endswith('.json'):
        model = json.load(f)
    else:
        try:
            import yaml
        except ImportError:
            raise SystemExit('Reading a YAML task model needs PyYAML (pip install pyyaml), or write the model as JSON.')
        model = yaml.safe_load(f)
with open(a.results) as f:
    results = json.load(f)
tasks = {t['id']: t for t in model['tasks']}
unknown = sorted(set(results) - set(tasks))
if unknown:
    raise SystemExit(f'results.json has tasks that are not in the model: {", ".join(unknown)}')

commands = collections.Counter()
with open(a.log) as f:
    for line in f:
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(e, dict) and e.get('action') not in OPERATOR:
            commands[e.get('session') or ''] += 1

rows = []
for tid, sessions in results.items():
    t = tasks[tid]
    valid = {s: v for s, v in sessions.items() if v is not None}
    if not valid:
        continue
    if 'ideal_steps' not in t or 'frequency' not in t or 'criticality' not in t:
        raise SystemExit(f'Task {tid} needs frequency, criticality and ideal_steps in the model')
    ok = sum(valid.values())
    steps = [commands[f'{tid}-{s}'] for s in valid if commands[f'{tid}-{s}']]
    if not steps:
        raise SystemExit(f'No logged commands for {tid} sessions {list(valid)}; check the session ids in the log')
    by_type = collections.defaultdict(lambda: [0, 0])
    for s, v in valid.items():
        by_type[s[0]][0] += v
        by_type[s[0]][1] += 1
    rows.append({
        'task': tid, 'role': t['role'], 'criticality': t['criticality'],
        'raw_weight': FREQ[t['frequency']] * t['criticality'],
        'success': ok / len(valid), 'n': len(valid), 'ok': ok,
        'median_commands': statistics.median(steps), 'ideal_steps': t['ideal_steps'],
        'by_type': ' '.join(f'{k}:{v[0]}/{v[1]}' for k, v in sorted(by_type.items())),
    })

total = sum(r['raw_weight'] for r in rows)
for r in rows:
    r['weight'] = r['raw_weight'] / total
    r['ratio'] = r['median_commands'] / r['ideal_steps']
    r['cost'] = r['weight'] * ((1 - r['success']) * 10 + r['ratio'])
J = sum(r['cost'] for r in rows)
rows.sort(key=lambda r: -r['cost'])

print(f'{"task":5} {"role":9} {"crit":>4} {"weight":>7} {"success":>8} {"median":>7} {"ideal":>5} {"cost":>6}  testers')
for r in rows:
    print(f'{r["task"]:5} {r["role"]:9} {r["criticality"]:>4} {r["weight"]:>7.1%} {r["ok"]:>4}/{r["n"]:<3} {r["median_commands"]:>7} {r["ideal_steps"]:>5} {r["cost"]:>6.2f}  {r["by_type"]}')
roles = collections.defaultdict(lambda: [0, 0])
for r in rows:
    roles[r['role']][0] += r['ok']
    roles[r['role']][1] += r['n']
print('by role: ' + ' · '.join(f'{k} {v[0]}/{v[1]} ({v[0] / v[1]:.0%})' for k, v in sorted(roles.items())))
ok_all = sum(r['ok'] for r in rows)
n_all = sum(r['n'] for r in rows)
print(f'overall {ok_all}/{n_all} ({ok_all / n_all:.0%}) · J {J:.2f}')

if a.before:
    with open(a.before) as f:
        before = json.load(f)
    prev = {r['task']: r for r in before['rows']}
    print(f'J {before["J"]:.2f} -> {J:.2f} ({J - before["J"]:+.2f})')
    regressed = [r['task'] for r in rows if r['criticality'] == 3 and r['task'] in prev and r['success'] < prev[r['task']]['success']]
    print('criticality-3 regressions: ' + (', '.join(regressed) if regressed else 'none'))
    print('accepted' if J < before['J'] and not regressed else 'NOT accepted')

if a.out:
    with open(a.out, 'w') as f:
        json.dump({'J': J, 'rows': rows}, f, indent=1)
