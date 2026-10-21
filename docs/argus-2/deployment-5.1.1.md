# Deployment archive repair — 5.1.1

The server screenshot shows ENOENT for `<release>/deploy.sh` in two deployment regression tests. `deploy.sh` staged only `Clasue-scout-app`, `instructions` and `scripts`. Tests run from the staged app and read the root deployment script, which was absent. The candidate therefore failed before activation.

Include tracked `deploy.sh` in the explicit Git archive paths. Keep tests, lint, build, health checks, rollback and private credential locations unchanged. A new assertion catches omission of the script from the candidate archive. Package and lockfile increment from 5.1.0 to 5.1.1.

Validation: regression assertion failed before the repair and passed after it; all 99 unit/API tests, production build, full active-module lint and Git Bash syntax validation passed. An actual Git archive was extracted into an isolated temporary release; patched deployment script/test copies were placed there, and all five deployment-cache tests passed without relying on the checkout's root script. No production database was modified.

All 16 fixture-only Edge browser checks also passed, including responsive screenshots at the six required widths, handoffs, offline recovery, role restrictions and real exports. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-asXx4T`. No frontend or export behavior changed; native PowerPoint rendering was not performed for this deployment-only fix.

The updater parses its deployment function before fetching changes. If an old copy of the updater picks up this fix during a run, that run can still fail using the earlier archive command; the following scheduled run reads the corrected script. Publish the commit to the configured deployment branch before expecting the server to receive it. No push or deployment was performed here.
