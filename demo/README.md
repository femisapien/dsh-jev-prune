# Deterministic behavior demonstration

The 24-second [GIF](../assets/demo.gif) presents captured outputs from the real plugin `apply()`, intercepted pruner, receipt injector, `jev_compact_now` and `jev_restore`. A simulated host and fixed judge scores make the run reproducible without credentials or remote inference. This is not a live DSH screen recording or a judge-quality benchmark.

The runner deliberately uses `keepMode: 'absolute'`, `compactMode: 'absolute'`, `compactThreshold: 0.2`, a lowered 1,000-character minimum and zero recent-node protection to isolate these behaviors. Automatic compaction is off until the manual tool is invoked. These are demonstration settings, not production defaults or configuration recommendations.

1. Inspect three long read-only tool outputs.
2. Trim two low-scored outputs; assert the high-scored output is unchanged.
3. Invoke receipt compaction; assert the protected output remains on the surface.
4. Retrieve a region checkpoint; assert archived text is returned without altering the surface.

```bash
npm ci
node demo/run.mjs
python -m pip install Pillow==10.2.0
python demo/render.py
```

The runner exits non-zero on an assertion failure, and generates [JSON evidence](../assets/demo.json) plus an [asciinema v2 recording](../assets/demo.cast). Replay the latter with `asciinema play assets/demo.cast`. GIF scene timing is six seconds per stage; runtime output is captured by the runner, not fabricated by the renderer. Long/Unicode output is retained in JSON and cast; the GIF uses a compact ASCII presentation.

Recovery here means read-only retrieval from a region summary checkpoint. Current retrieval caps each event at 4,000 UTF-16 units, does not reinsert events into the surface and cannot directly resolve layer-1 or mixed-batch replacement IDs. This demo does not exercise concurrent compaction, goal changes or live judge failures. See [review findings](../docs/review-2026-10-05.md).

`fixtures.mjs` is a snapshot of the smoke-test host helpers. When event shapes change, update both fixtures and verify against a live host before claiming new compatibility.
