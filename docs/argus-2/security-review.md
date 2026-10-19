# Security and release review

## Result

Focused source review found and fixed the publish-blocking issues described below. The final dependency audit reports zero known vulnerabilities. No configured API keys occur in publishable files. This is a focused review, not an independent penetration test or a guarantee against unknown vulnerabilities.

## Scope and baseline

Reviewed the working tree against 8d19ef2 and the prior deployment history. The deployment baseline origin/main was c14f311. The highest-risk changes are server authentication, collection authorization, immutable report uploads, offline account isolation and hosted AI requests. These affect every API-backed screen. Shared analytics supplies the profiles, comparisons, presentations, exports and analyst.

Reviewed server.cjs, analyst-service.cjs, offline-client.js, offline-store.js, active frontend authentication/draft code, analytics calculations, strategy revisions and the deployment secret-loading path. Searched all existing publishable tracked and untracked text files for the actual configured credentials. The unused Firebase frontend is not part of the deployed build and was not runtime-tested.

## Fixed findings

- Removed the remaining hardcoded official-data key from the unused Firebase entry. It now uses the authenticated server proxy. Stale generated public bundles have been removed.
- Ignored private environment files, persistent argus.env, local databases and recovery files, dependency/build output, browser reports, coverage, Python caches and private key files. The example environment file contains no credentials. The database was already tracked, so it was removed from the Git index while its local contents were retained unchanged.
- Updated vulnerable dependency locks and pinned patched compatible dependency overrides for grpc-js and image-size. Both full and production dependency audit results are zero known advisories after installation. PowerPoint exports remain covered by real file tests and browser downloads.
- Upgrade legacy password hashes to salted scrypt after successful login. Successful authentication clears its failure bucket; account-scoped buckets avoid locking out all scouts behind one proxy.
- Blocked direct API deletion of form templates and events, preserving historical evidence and unfinished drafts.
- Added nosniff, frame-denial and referrer headers. API responses remain no-store. Session cookies remain HttpOnly and SameSite Strict; HTTPS deployments should set COOKIE_SECURE=true in their private configuration.
- Production can load credentials from argus.env beside DB_FILE, outside disposable release directories, or ARGUS_ENV_FILE. A Git push never copies the local private environment file.

## Authorization and integrity checks

Anonymous API access fails. Workspace membership, roles and report authorship are enforced server-side. Members cannot retrieve another scout's private reports. Unknown fields and legacy records remain intact. Report IDs are immutable and safe to retry; stale picklist, assignment and metric writes conflict instead of overwriting. Role changes invalidate downloaded read snapshots while preserving drafts and queued reports. Event switching does not delete data.

Groq only receives a bounded summary calculated from server-authorized event reports. Client-supplied analytics are not trusted. Photos, drawings, notes and scout names are excluded. Returned source IDs are filtered against supplied evidence. AI interpretations remain labelled as such because citation presence cannot prove a generated claim. Requests are rate-limited; missing configuration, quota errors and service errors fall back to the local analyst.

## Validation and limits

46 unit/API/offline/export checks pass, the production build passes, and focused ESLint on changed active modules passes. Browser regression checks cover desktop and phone navigation, role isolation, archived drafts, offline reload and reconnection, picklist persistence, global search and real PDF/PowerPoint downloads. The source review did not find an unresolved release-blocking issue in these paths.

The real local database retains its baseline SHA256. Test mutations use fresh temporary databases. PDF pages have been rendered and inspected. Native PowerPoint rendering remains unavailable; editable package structure and downloads are tested. Live Groq and official-data connections were verified separately using private configuration and synthetic evidence, without sending real scouting reports.

API keys remain private and are excluded from the commit. The production host needs its own private argus.env. Historical official-data credentials and the database existed in older commits; this release removes them from current source and does not rewrite repository history. Deployment on push to main is explicitly authorized by the user for this release.

## Browser connection setup

Added workspace-owner-only integration import after the user requested terminal-free server setup. Keys are stored in a private file beside DB_FILE and survive release changes and restarts. Responses expose connection booleans, never keys. Membership and ownership are checked for the requested workspace; the offline client identifies its active workspace for provider lookup. The private handoff file is ignored and secret scanning found no actual configured key in publishable files. 47 tests, focused ESLint, the build and 15 browser workflow checks pass, including import, reload persistence and cross-workspace permission rejection. The local database remains unchanged.
