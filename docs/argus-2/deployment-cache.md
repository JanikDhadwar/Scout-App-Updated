# Deployment cache invalidation

Every production build receives a unique release ID, including a forced rebuild of the same commit. The updater activates the build and verifies origin health. Cloudflare cache purging is optional: without a token and zone ID, installation and deployment continue without contacting Cloudflare. When configured, the updater purges the dedicated zone before marking the revision fully deployed. A failed configured purge is retried on the next updater run without rebuilding an already healthy release.

## Optional private server configuration

No Cloudflare settings are needed to run `bash scripts/install-debian.sh`. To enable automatic cache purging later, create `cloudflare-deploy.env` beside the persistent database in `~/.local/share/scout-app` (or the configured `SCOUT_STATE_DIR`). Keep the directory mode 700 and file mode 600. Never put this file in Git, a release directory, browser settings, or a chat message.

The file contains these variables, with real values entered privately on the server:

```dotenv
CLOUDFLARE_API_TOKEN=<private token>
CLOUDFLARE_ZONE_ID=<32-character zone ID>
SCOUT_PUBLIC_HOST=6390scout.app
```

Use a Cloudflare API token with Zone Read and Cache Purge permissions restricted to the dedicated `6390scout.app` zone. The purge helper verifies the zone name before using `purge_everything`; it refuses a parent/shared-zone purge. This clears all cached content in that dedicated zone. Completely absent credentials skip purging. Partial or malformed settings still block deployment before activation to expose configuration mistakes. Invalid credentials or an unavailable Cloudflare API leave the healthy origin serving while the updater retries the failed purge. Without credentials, existing Cloudflare caches cannot be cleared automatically; build IDs and origin no-store headers still apply, but external cache rules may keep serving older content.

Cloudflare's [purge API](https://developers.cloudflare.com/api/resources/cache/methods/purge/) documents the operation. Make sure custom Cache Rules or Workers do not override the origin's no-store policy or independently cache app responses. Such external configuration is not changed by this implementation.

## Browser and offline behavior

- HTML, assets, service-worker files, release checks and API responses carry browser and CDN no-store headers, including Cloudflare-CDN-Cache-Control. Static ETags and Last-Modified validators are disabled.
- Each build uses a new service-worker precache and image cache. Activation cleans obsolete app caches. Images use network-first fetching with an offline fallback.
- Open clients check for service-worker updates on return to the app, reconnection and every minute. A visible update notice asks the user to finish their edit and load the new version; updates do not force a reload through an unfinished form.
- A confirmed new release invalidates downloaded read snapshots and readiness flags across accounts/workspaces. In-flight old reads cannot repopulate them. Current authorized data is downloaded again.
- IndexedDB `scout-device-v1`, draft keys, pending reports, upload receipts and real server records are retained. A failed/offline release check does not clear downloaded data.

Changes must use the normal build/deploy path; copying source files into a running release is not a redeploy. Pushing commits alone does not purge the edge before the origin is ready. The existing minute-based updater deploys the latest pushed commit.

## Validation

October 20, 2026: removed the mandatory credential setup after the user reported difficulty entering tokens on the server. A failing regression test reproduced the installer preflight rejection, then passed after the change. Both CLI preflight and purge commands now exit successfully without credentials; partial/malformed credentials remain errors and configured purge safety tests still pass. All 66 tests, the production build, focused ESLint and `git diff --check` passed. No UI changed, no live Cloudflare calls were made and no server deployment was attempted. The complete Debian/systemd installation still needs verification on the server.

Automated tests cover dedicated-zone verification, full purge payload, sanitized failures, deployment ordering/retry markers, response headers and release snapshot invalidation without losing drafts, uploads or receipts. No real Cloudflare purge or production deployment is performed by these tests.

Local validation: 64 unit/API tests and 28 fixture-only Edge browser checks passed, including offline reload/reconnection and six viewport widths. Production build and focused ESLint passed. Consecutive builds generated different release IDs. Executing the built cleanup handler against synthetic cache names removed only obsolete app image caches, retaining the current and unrelated caches. Bash is not installed in the Windows validation environment, so the deployment shell path has ordering tests but was not executed locally. Live token permissions, custom Cloudflare rules and actual edge invalidation still require server-side verification after credentials are configured. No push or deployment was performed.
