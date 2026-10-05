## Measured results

Numbers below come from a three-arm measurement of a 37-step "read every file in a directory, strictly one at a time" long task over `semver@6e05b76`: **A** = vanilla DSH (baseline), **B** = the plugin with `compactReceipts: false` (layer 1 only), **C** = the plugin with defaults (both layers). Every number is taken from the `usage` object the API actually returned in the DSH session logs — no estimator is involved in scoring.

**Layer 1 acts on every long run; the baseline never does.** Layer 1 trimmed stale results in every plugin-arm run (4–7 nodes per long run; arm A trims 0 by definition), and answers on the short/medium/long tasks were correct in every arm.

**Long tasks run on a fraction of the full-price input.** Uncached ("full-price") input tokens per completed 37-step run: baseline 75,781–87,872 vs full plugin 25,516–45,071 — roughly a third of the baseline at equal task scope. Report token classes separately: the cache-hit share of input is high (78–94%) and hit/miss prices differ by ~50×, so total-token comparisons mislead by design.

**Fewer destructive compactions — some of them receipts instead of summaries.** Per completed long run, DSH's own model-written summary compactions dropped from 31–40 (baseline) to 15–23 with the full plugin, of which 6–8 were replaced by deterministic receipts rendered by code. Layer 2 stays deliberately silent on short/medium tasks — its gates require a contiguous run of eligible read-only steps — so on those workloads the effect comes from layer 1. Even when layer 2 fires, DSH-initiated compactions still exist and fall back to model summaries: the plugin reduces them, it does not eliminate them.

**A failure mode we found and fixed.** Receipts replace a whole "call + result" step, including the assistant message that carried it; in one long run the model's intermediate notes were erased step by step (12 of 13) and it stopped issuing tool calls mid-task. Receipts now carry each step's **assistant-visible text verbatim** (`text` blocks only, `reasoning` drafts excluded, zero model generation; bounded by `receiptTextChars`, default 400, `0` disables). After the fix, the same long task completed in every run with correct answers.


## Evidence boundary

These figures were reported in the upstream README before this documentation change. Raw session logs, repetition counts, full scoring criteria, model/judge versions and judge spend are not committed. Treat the ranges as workload-specific observations, not a general cost-saving guarantee. The deterministic demo is a behavior check and is not the measured experiment.
