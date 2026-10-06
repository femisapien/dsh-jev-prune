# Changelog

## 0.1.1 — 2026-10-06

- Accept tools from verified 0.1 and 0.2 release families, dynamically report runtime version and capabilities, and resolve preset-local compaction services for each Agent.
- Add actual CLI installation and Web preset activation verification, plus an advisory rolling @next CI job. Keep the locked old-host regression fixture.

- Fix #48: scope receipts to asynchronous compaction transactions, clear inherited ownership at host region entry, validate replay input and preserve claim-once/cancellation behavior.
- Fix #49: invalidate result judgments when the recent user-instruction revision changes, retain effect judgments, refresh before manual actions and discard old-goal responses arriving in flight.
- Expand simulated-host checks from 113 to 130. The receipt/goal regression subset was reverse-verified against 0.1.0: 14 of its 127 assertions failed.

## 0.1.0 — 2026-10-06

- Concise English and Chinese project introductions; implementation/configuration history moved behind architecture links.
- Reproducible 24-second deterministic behavior recording, JSON evidence and terminal replay. Real plugin code runs against a simulated host with fixed judge scores.
- Release preparation and source-review findings covering PR #45 and issue #35.

### Runtime features

- Semantic result trimming with pressure budgets, bounded excerpts and native fallback.
- Deterministic receipts for full read-only steps and mixed parallel result bodies.
- Recent-node, evidence and tool-pairing checks; region-checkpoint text retrieval.
- Judge request retries, batch isolation and status/heartbeat diagnostics.
- Cross-platform smoke checks, coverage gates and a locked DSH dependency fixture.

Known limitations: pending receipt fencing does not identify external concurrent transactions; result caches do not invalidate on goal changes; replacement IDs are not directly restorable; small-sample layer-1 fallback can act at zero pressure ratio. See [review details](docs/review-2026-10-05.md).

Repository layout: helpers now live in `src/`, tests in `test/`, tools in `scripts/`, and project documentation in `docs/`. Public package imports and the root plugin entry remain compatible. Direct helper-script paths changed; use the updated documented commands.
