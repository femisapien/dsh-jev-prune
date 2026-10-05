# Changelog

## Unreleased

- Concise English and Chinese project introductions; implementation/configuration history moved behind architecture links.
- Reproducible 24-second deterministic behavior recording, JSON evidence and terminal replay. Real plugin code runs against a simulated host with fixed judge scores.
- Release preparation and source-review findings covering PR #45 and issue #35.

## 0.1.0 — source version, not a published release

- Semantic result trimming with pressure budgets, bounded excerpts and native fallback.
- Deterministic receipts for full read-only steps and mixed parallel result bodies.
- Recent-node, evidence and tool-pairing checks; region-checkpoint text retrieval.
- Judge request retries, batch isolation and status/heartbeat diagnostics.
- Cross-platform smoke checks, coverage gates and a locked DSH dependency fixture.

Known limitations: pending receipt fencing does not identify external concurrent transactions; result caches do not invalidate on goal changes; replacement IDs are not directly restorable; small-sample layer-1 fallback can act at zero pressure ratio. See [review details](docs/review-2026-10-05.md).
