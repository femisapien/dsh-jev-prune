# Host compatibility and direct installation

## Version evidence (2026-10-06)

[Recorded verification evidence](current-host-verification.json)

| Plugin | DSH | Evidence |
|---|---|---|
| Published npm 0.1.0 | 0.1.5-rc.2 | Locked dependencies and simulated-host checks. |
| Published npm 0.1.0 | 0.2.0-rc.2 | Actual CLI rejects the old tools peer range; nothing installed. |
| Prepared 0.1.1 source | 0.2.0-rc.2 | CLI archive install, composed config, 130 addon checks, real Web startup and standard-preset service takeover passed. |

The release preparation verifies a generated 0.1.1 archive. Registry publication is checked separately, followed by installation of the exact published npm version; archive verification alone is not that registry check.

## Locking versus compatibility

The old 0.1.5-rc.3 publication omitted required child packages; caret ranges drifted into that incomplete tree. The committed ci/dsh-host lockfile keeps old regressions reproducible. It is a test fixture, not a runtime pin. Published 0.1.0 separately declares an old tools peer range that newer DSH rejects before installation.

Startup reads the actual installed DSH version; the manifest supplies tested versions and supported families. Boot makes no registry requests and does not auto-update the host. Exact tested, untested-but-supported, unsupported and unknown versions are reported separately from service capabilities.

Known-family diagnostics do not bypass declared peer ranges: a future prerelease may still be rejected by DSH's semver check until its tuple is explicitly accepted and verified.

Legacy root services remain supported. New Web profiles isolate compaction inside Agent presets; the plugin calls the host's serviceForAgent API before the host pruning pass. It hooks each engine once and disposes hooks with the plugin. Presets without these services remain untouched. Unsupported shapes retain host fallback behavior.

The tools peer range is `^0.1.5-rc.2 || ^0.2.0-rc.2`. It intentionally does not accept every future release. Successful verification should precede widening it further.

## Reproduce

```bash
npm ci
npm run verify:current-host
DSH_VERIFY_SPEC=@deepseek-ai/dsh@0.2.0-rc.2 npm run verify:current-host
```

PowerShell uses `$env:DSH_VERIFY_SPEC = '@deepseek-ai/dsh@0.2.0-rc.2'` before the command.

The script creates an isolated host/home, packs the plugin, runs the actual `dsh plugin --profile web add <archive> --ignore-scripts`, checks configuration and addon tests, starts Web on a temporary loopback port with `--no-open`, creates an empty standard-preset Agent and dispatches an empty pre-step. It verifies takeover flags, disposes the Agent and stops the child server. It sends no task and invokes no model inference; TypeSafe is disabled. Artifacts remain at the printed temporary path. An existing isolated installation can be reused with `-- --host-dir <path>`; each run still gets a fresh home.

Native build scripts are skipped. This proves this plugin's installation and attachment, not every native DSH tool. pnpm must be on PATH; initial downloads can take minutes.

## CI boundaries

Locked old-version jobs remain gates. A rolling @next install/activation check runs on PRs, main and weekly, as an advisory job. A broken upstream publication is visible without replacing the baseline. This is installation/activation evidence, not live Jev quality or long-task success; measurement issue #37 remains separate.
