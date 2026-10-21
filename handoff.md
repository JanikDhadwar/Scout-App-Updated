# Argus handoff

Updated: October 20, 2026.

## Latest work: compact mobile and admin coverage

Release follow-up: 97 tests now pass. Offline help uses canonical LF content with Windows/Linux source checks, and deployment now requires active-module lint as well as tests before build/activation. A failed candidate check leaves the currently serving release in place. Target-server shell/rollback verification remains outstanding; do not push or deploy without authorization.

Production-mode local staging also passed all 15 Edge workflows with Secure/HttpOnly/SameSite=Strict session-cookie assertions. Use `QA_NODE_ENV=production` with the fixture runner to repeat it. Team detail windows now page missed/dismissed matches (four per phone page, six desktop), with team actions above the list. A 13-missed-match phone case fits without scrolling through a long list. A public read-only check of the existing live homepage returned HTTP 200, no-store and Cloudflare DYNAMIC; this does not verify the uncommitted code on the real server. Completing actual Debian updater/startup/rollback checks still requires the server's access details; choosing local staging does not grant or create that access.

The current local changes add a compact team-status grid in Admin control centre. Red means missing pit evidence, yellow means missed played matches after pit warnings are resolved, and green means covered or explicitly dismissed. Unknown schedules are not called complete. Colour is paired with distinct symbols and accessible labels. Team details show responsible scouts and missed matches. Admin/Owner dismiss and restore actions are server-authorized, revision-checked, audited, persistent and never invent reports or change analytics. New missed matches raise new warnings.

Phones use six teams per page, a single Admin section picker and collapsed secondary progress panels. Desktop uses twelve teams per page. Search/filter/paging avoid a long match list. The sidebar now lists five main areas; secondary pages remain in Page tools and the grouped phone More dialog. Phone dashboard summaries/charts and compact-match handoff tools start collapsed, while incoming handoff requests and primary scouting actions remain available.

See [implementation, verification and remaining launch checks](docs/argus-2/compact-admin-and-mobile.md). The full test suite currently passes 95 tests; fixture-only Edge checks cover 15 workflows, including a synthetic 48-team rendering, phone viewport fit, offline recovery, real downloads and dismissal persistence. Active-module lint and production/PWA build are checked. Native PowerPoint rendering and actual production hosting/deployment checks remain unverified; do not describe the unseen production installation as certified ready.

The current checkout declares `web-push@3.6.7` but the local dependency tree lacked it. This session's local server/test commands use a temporary installation through `NODE_PATH`; no manifest/lockfile changes were made. A normal fresh install with `npm ci` installs it. If restarting in this same environment without npm, install the declared dependencies or supply that dependency path. The local Windows database durability fix opens the temporary fsync handle as `r+` rather than read-only; migration and restart checks pass.

## Current state

Argus runs locally at http://localhost:3001. The active application is `Clasue-scout-app/src/frc-scout-local.jsx`, served by `Clasue-scout-app/server.cjs`. The Firebase entry is unused. Read `AGENTS.md` before making changes.

Work remains uncommitted on `main`. Nothing from this work has been pushed or deployed. A push to the deployment branch triggers the production updater, so obtain explicit deployment authorization first. Preserve all existing edits, including the local Vite configuration and `pnpm-workspace.yaml`.

## Implemented

- Argus branding, five main navigation destinations, scrollable/hideable sidebar, dismissible setup guidance and contextual next steps.
- Any-event selection, regardless of team attendance; additive event imports and event archiving without deleting reports.
- Pit display with livestream and upcoming matches; team number configured in Settings.
- One-button Blue Alliance/Groq connection checks with private server-side credentials.
- One-click whole-team pit and match assignments, custom scout selection, assignment context and server-enforced submission limits.
- Restored historical report search, question summaries, filtered CSV/JSON exports, pit visit overview/undo, older allocation visibility and non-owner leave-workspace controls.
- Deployment cache invalidation: unique build IDs, no-store browser/CDN headers, per-build service-worker caches, update prompts and downloaded read-cache refresh. Drafts, queued reports, receipts and real competition records are preserved.
- Cloudflare purge after healthy activation; failed purges are retried before a deployment is marked complete.

Historical feature comparison used commit `e1a3276a36ac104c63ef92923eac0400ada35ed0` ("Named it Argus"). Destructive old workflows were intentionally replaced with archive/history-preserving behavior.

## Things to do

1. Cloudflare configuration is optional. Installation and updates skip purging when both credentials are absent. To enable it later, `cloudflare-deploy.env` belongs beside the persistent database, outside Git/releases. It needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` and `SCOUT_PUBLIC_HOST=6390scout.app`. Use Zone Read and Cache Purge permissions scoped only to the dedicated app zone. Follow [deployment cache setup](docs/argus-2/deployment-cache.md). Do not paste secrets into this file or chat. Partial/malformed settings still block activation; configured purge failures are retried.
2. Inspect production Cloudflare Cache Rules/Workers for anything overriding no-store or maintaining a separate cache. External Cloudflare configuration has not been changed or verified.
3. Validate the deployment shell path on Debian, including health failure/rollback and purge failure/retry. Bash was unavailable in the Windows validation environment; deployment ordering has automated tests, but the actual shell deployment was not executed.
4. Review the dirty working tree and rerun checks before requesting authorization to commit/push/deploy. Do not reset unrelated edits or replace the live database.
5. After an authorized deployment, verify the real Cloudflare purge, release/health responses, new-version prompt and offline draft/queue retention across the update. No live purge has been performed yet.
6. Complete a signed-in, read-only comparison with the live website if exact live-site parity is still required. Earlier live-site authentication did not succeed; historical GitHub comparison is documented, but it is not proof of every live-only feature.
7. Inspect exported PDF pages visually and check the editable PowerPoint in a native renderer before claiming full visual export validation. Export generation and real browser downloads pass; native PowerPoint rendering remains unverified.

## Run locally

From `Clasue-scout-app`:

```powershell
npm run build
npm start
```

Open http://localhost:3001. The current local instance already serves the latest built app. Do not start a second server if port 3001 is occupied by this instance. `npm run dev` is available for frontend development with the API proxy.

By default, the local server uses `Clasue-scout-app/db.json`. `DB_FILE` selects another database and `APP_PORT` selects another port. Never use real data for mutable automated browser checks. Keep integration files private beside the selected database; never copy keys into source or release artifacts.

## Validation status

Last implementation checks: 64 unit/API/offline/export tests passed, focused ESLint passed, and production/PWA build passed. All 28 Edge browser checks passed against a temporary fixture database, including offline reload/reconnection and layouts at 1440, 1280, 1024, 768, 390 and 360px. Consecutive builds produced different release IDs; synthetic execution of the built cache cleanup retained current and unrelated caches.

Normal verification commands from `Clasue-scout-app`:

```powershell
npm test
npm run build
npm run test:browser
```

The previous environment lacked the npm launcher, so the equivalent installed Node test runner, Vite and browser-runner scripts were used directly. Run focused ESLint on changed active modules as well. Documentation-only handoff changes do not alter application behavior.

## More context

- [Cache deployment and remaining configuration](docs/argus-2/deployment-cache.md)
- [Historical version feature mapping](docs/argus-2/rename-version-parity.md)
- [Restored workflows](docs/argus-2/restored-workflows.md)
- [Usability and parity notes](docs/argus-2/usability-and-parity.md)

Never clear `scout-device-v1` or delete drafts/queues to resolve a stale UI. Never restore an old database over newer reports. Keep authorization server-side and keep unknown/legacy fields intact.
