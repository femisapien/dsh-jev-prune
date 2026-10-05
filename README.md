# dsh-jev-prune

![dsh-jev-prune](assets/banner.png)

Semantic tool-result pruning and deterministic receipt compaction for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), judged by [TypeSafe Jev](https://typesafe.ai).

**English** · [简体中文](README_zh.md)

![license](https://img.shields.io/badge/license-MIT-blue) ![node](https://img.shields.io/badge/node%20%3E%3D22.19-339933) ![dsh](https://img.shields.io/badge/DSH-0.1.x--rc-orange) [![CI](https://github.com/yangyu666/dsh-jev-prune/actions/workflows/ci.yml/badge.svg)](https://github.com/yangyu666/dsh-jev-prune/actions/workflows/ci.yml) ![smoke checks](https://img.shields.io/badge/smoke%20checks-113%20passing-success) [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yangyu666/dsh-jev-prune)

## The problem

Long-running agents accumulate tool output. Size-based truncation cannot distinguish useful evidence from spent output, while model-written summaries can introduce unsupported statements. This plugin uses structured judgments to select what to reduce, preserves the original session events, and generates receipts in code.

## Two layers

| Layer | Behavior |
|---|---|
| Result trimming | Rank candidate tool outputs and trim selected bodies to head/marker/tail. Recent and protected results are kept; missing judgments fall back to native size rules. |
| Receipt compaction | Replace eligible read-only steps with factual receipts. Mixed parallel batches retain call/result envelopes and replace only eligible result bodies. |

![Two layers](assets/two-layers.png)

Receipts record tool names, arguments, sequence numbers and output sizes, with bounded verbatim assistant text. Write-like calls, recent nodes, evidence patterns and pairing checks constrain layer 2. [Implementation and configuration](ARCHITECTURE.md#implementation-reference)

## Demo

![Recorded deterministic demonstration](assets/demo.gif)

The recording runs the real plugin `apply()`, registered tools and replacement paths against a simulated DSH host with fixed judge probabilities. It shows trimming, preservation of a high-scored result, receipt compaction, and retrieval of a region checkpoint's original text. It does **not** measure live Jev quality or prove live-host compatibility.

[Replay, assertions and regeneration](demo/README.md) · [Machine-readable evidence](assets/demo.json)

## Measured results

The previously reported 37-step sequential `semver@6e05b76` reading task compared vanilla DSH, layer 1 only and both layers. Reported uncached input tokens per completed long run were **75,781–87,872** for baseline versus **25,516–45,071** with both layers. These are workload-specific upstream observations, not an independently reproducible benchmark: raw logs, judge costs and a complete reproduction harness are not shipped here. Cached and uncached input must be reported separately.

[Measurement details and boundaries](docs/measurements.md)

## Quick start

Requires Node `^22.19.0 || >=24.0.0`, a DSH profile with the base pruner/compaction services, and `TYPESAFE_API_KEY`. The tested host is **DSH 0.1.5-rc.2**.

```bash
git clone https://github.com/yangyu666/dsh-jev-prune.git
cd dsh-jev-prune
npm ci
npm run check
npm run smoke
# Use the absolute path to this checkout:
dsh plugin --profile web add link:/absolute/path/to/dsh-jev-prune
```

Set `TYPESAFE_API_KEY` in the environment before starting DSH. Start with `dryRun: true`; use `/jev` for status and `jev_probe_shapes` to check host event shapes. `jev_restore` retrieves region-checkpoint text read-only; it does not restore the surface.

For machines without pnpm, see [manual profile wiring](docs/implementation.md#install). For pinned GitHub installation and release readiness, see [release preparation](RELEASING.md). No npm publication or release tag is assumed by these commands.

## Limits and data handling

- Live judging sends history, paths, snippets and command output to TypeSafe and adds inference cost and latency.
- Automated CI covers helpers, simulated-host behavior and loading against a locked host dependency tree. It does not exercise a live DSH session end to end.
- Pending receipts are claim-once, but current fencing does not identify an external concurrent summary's transaction. Avoid concurrent compaction; see [review findings](docs/review-2026-10-05.md).
- Result judgments are cached by sequence, without task-goal invalidation. Small-population layer-1 fallback can trim at zero pressure ratio.
- `jev_restore` currently finds region summary checkpoints, truncates each returned event to 4,000 UTF-16 units, and does not directly resolve layer-1 or partial-result replacement IDs. Original events remain in the log.

## Development

```bash
npm run check
npm run smoke
npm run coverage
node demo/run.mjs
```

[Contributing](CONTRIBUTING.md) · [Architecture](ARCHITECTURE.md) · [Full configuration](docs/implementation.md#configuration) · [Porting contract](PORTING.md) · [Examples](examples/README.md) · [Changelog](CHANGELOG.md)

MIT.
