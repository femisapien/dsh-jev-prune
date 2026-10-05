# Fixed-version release preparation

Release tags, GitHub releases and npm packages are created from a verified merged commit. `package.json` identifies version `0.1.0`; check the GitHub release and npm registry for distribution availability.

## Before tagging

1. Resolve or explicitly accept the [runtime review findings](review-2026-10-05.md). Use an experimental prerelease while they remain; do not imply production readiness.
2. Review PR #45's changelog/install changes against this PR; reconcile overlapping README changes. Keep issue #35 open until published artifacts exist.
3. From the merged commit, run the check, smoke, coverage and deterministic demo commands. CI must pass; validate the intended DSH profile in a real host separately.
4. Choose a version, update `package.json` and the lockfile together, and change the changelog's prepared heading only when actually publishing.
5. Run `npm pack --dry-run`; check documentation, replay and demo assets ship. Never include private logs or credentials.

## Pin and release the verified commit

```bash
# Replace both placeholders with the chosen version and VERIFIED merged SHA.
git tag -a <version-tag> <verified-commit-sha> -m "Experimental release"
git push origin <version-tag>
# Create a GitHub release for that tag, with experimental status and known limits.
dsh plugin --profile web add github:yangyu666/dsh-jev-prune#<version-tag>
```

Verify that the pinned installation succeeds in a clean DSH profile. A tag must identify the validated merge result; it must not point to an older branch or to this PR's unmerged head by accident. The GIF/JSON/cast can be attached to the GitHub release.

## Optional npm distribution

Use the owner's npm login and required authentication to publish the exact version. Check `npm view dsh-jev-prune@<version> version` and install that exact published version in a clean profile before adding an npm-first command to the README. GitHub tag publication and npm publication are separate operations.
