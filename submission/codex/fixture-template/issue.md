# Add deterministic GitHub label normalization

## Context

The fixture project can identify release labels, but callers also need a stable
way to normalize human-entered GitHub labels before comparison.

## Acceptance criteria

- Export `normalizeLabel(label)` from `src/labels.mjs`.
- Throw `TypeError` when `label` is not a string.
- Trim leading and trailing whitespace and lowercase ASCII letters.
- Treat each run of whitespace or underscores as one hyphen.
- Remove characters other than lowercase ASCII letters, digits, and hyphens.
- Collapse repeated hyphens and remove leading or trailing hyphens.
- Return an empty string when no valid characters remain.
- Preserve the existing `isReleaseLabel` behavior.
- Add deterministic unit coverage for normal text, repeated separators, punctuation, an all-invalid value, and a non-string input.
- Keep the project dependency-free and make `npm test` pass.

The result must stop at a merge-ready pull request. Do not merge or deploy it.
