# Docs Review

Review the Mallory documentation in **this repository** (the docs repo) for consistency, accuracy, and freshness. The docs repo is a sibling of the rules repo; all paths below are relative to the docs repo root (e.g. `use/monitor.mdx`, `build/search-syntax.mdx`).

## Your role

Act as an expert documentation maintainer. You care about:

- **Consistency** – Same concepts use the same terms (e.g. "observables" vs "IOCs", "references" vs "citations"). Cross-links and nav match.
- **Accuracy** – Descriptions match current app and API behavior (endpoints, parameters, UI flows).
- **Freshness** – No outdated feature flags, deprecated flows, or references to removed functionality.
- **Structure** – Frontmatter (`title`, `description`), headings, and CardGroup links are used consistently.

## Scope

- **Include**: All `.mdx` (and any `.md`) under the docs repo root (e.g. `use/`, `build/`, `concepts/`, top-level pages).
- **Reference**: Use the app (e.g. app.mallory.ai), API reference, and core/web codebases only to **verify** claims; do not change code.
- **Output**: A single, actionable list of suggested doc changes—no edits until the user approves.

## How to run the review

1. **Enumerate** – List all doc files (e.g. `use/*.mdx`, `build/*.mdx`, `*.mdx`, `*.md`) in this repo.
2. **Read** – Read each file and note: terminology, API/app behavior described, cross-links, and any version or status wording.
3. **Verify** – For important claims (endpoints, parameters, UI labels, flows), spot-check against the API or app when helpful. Prefer high-impact pages (quickstart, auth, search, monitor, entities).
4. **Compare** – Cross-check use vs build docs (e.g. use/monitor vs build/monitor) and linked cards for alignment.
5. **List issues** – Record each finding with: location (file + section), issue type (terminology | accuracy | freshness | structure), and a short recommendation.

## Output format

Produce a **numbered markdown table** of suggested changes, then ask for approval before making any edits.

```markdown
## Docs review – suggested changes

| #   | File          | Section / location | Type      | Issue                 | Recommendation                      |
| --- | ------------- | ------------------ | --------- | --------------------- | ----------------------------------- |
| 1   | use/foo.mdx   | "Step 2"           | Accuracy  | Says X but API does Y | Update to describe Y or add caveat. |
| 2   | build/bar.mdx | CardGroup          | Freshness | Links to removed page | Update href to … or remove card.    |
| …   |               |                    |           |                       |                                     |

**Summary**: N suggested changes (terminology: n, accuracy: n, freshness: n, structure: n).

Proceed with these changes? Reply with: all, none, or the numbers to apply (e.g. 1, 3, 5).
```

- **Type** must be one of: `Terminology` | `Accuracy` | `Freshness` | `Structure`.
- Keep recommendations concrete (what to change, not just "fix").
- If there are no issues, say so clearly and skip the table.

## After approval

- If the user approves (all or a subset), apply only the approved rows: edit the listed files, then report what was changed.
- If the user says "none" or "no", do not edit; optionally offer a one-line summary of what was reviewed.
