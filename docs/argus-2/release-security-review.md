# Release security source review — 2026-10-25

Follow-up in 5.9.0: aggregate address/global auth limits, bounded failure buckets, per-account/address join limits, owner-only random join-code rotation with password confirmation, assignment workload limits and route throttles were added after this baseline review. New API tests exercise rotating-username signup exhaustion, join throttling, expired/full buckets, invalidated old invitations, owner isolation and oversized schedules. The baseline findings below are retained for traceability; see release-readiness-5.9.0.md for final evidence and remaining operational/legal blockers. Hashing remains synchronous and production proxy address handling needs verification.

Scope: the active Express server, database/session persistence, assignment and upgrade routes, offline account restoration, report exports, notification delivery, and Debian release packaging. This was a bounded source review of the working tree before the release hardening changes. It did not access real database records, private integration files, credentials, or production infrastructure. Line references describe the reviewed snapshot and can move as fixes land.

## Architecture and trust boundaries

The browser authenticates through an opaque cookie. `server.cjs` resolves that cookie against a private session file and a current, enabled database user before protected API routes. Domain membership/admin/owner checks scope application records. JSON database updates run synchronously in one Node process. Browser drafts and queues remain in IndexedDB under account/team scopes. External integrations use server-side credentials. Static serving is restricted to `dist`; release packaging uses `git archive`, with persistent data outside releases.

## Actionable findings

### High: public account creation bypasses the only authentication throttle

Evidence: `Clasue-scout-app/server.cjs:82–100` keys attempts by IP **and submitted username**. Successful authentication deletes that key (`server.cjs:58`). The map cleanup at line 85 removes only expired entries, even above 10,000 entries. Password hashing/verification use synchronous scrypt (`server.cjs:44,50`), and successful registration writes the full database and private session file.

An unauthenticated client can rotate usernames to create unlimited accounts from one address. Each unique name gets another bucket; successful signup clears its bucket. Requests can consume CPU, event-loop time, disk, and map memory while other scouts are trying to submit. Existing-account password spraying also evades an aggregate address limit.

Required fix: independent, bounded address/global limits for signup and authentication, retained after success; bounded bucket eviction; input/body limits before expensive work. Account creation needs explicit abuse controls for a public launch. Asynchronous password hashing plus a bounded work queue/concurrency limit is preferable to unbounded synchronous hashing. With a reverse proxy, derive client addresses only from explicitly trusted proxy hops; trusting arbitrary forwarded headers allows spoofing, while treating every visitor as localhost locks out everyone together.

Regression evidence needed: against a disposable fixture, distinct usernames from one source eventually receive 429, successful signup cannot reset the aggregate limit, a second independent source remains usable, bucket capacity stays bounded, and unauthenticated requests cannot monopolize hashing concurrency. Do not stress-test production.

### Medium: team invitation guessing is unthrottled

Evidence: `server.cjs:105–111` permits any nonempty, user-chosen join password; the generated default is stronger. `server.cjs:113–119` checks join passwords without a failure limiter. Open registration supplies an attacker with an authenticated account.

An attacker can repeatedly try common codes against a known team number. A successful guess creates membership and grants that team's member-visible event/form/assignment and approved analytics access. This is not a cross-team authorization bypass when a strong invitation is used; it is an online guessing exposure for weak owner-selected codes.

Required fix: bounded failed-join limits per account/address/target team, sensible invitation length/entropy limits, and a usable rotate/revoke mechanism. Retain generic error responses. Test that failed guesses reach 429 without leaking the invitation, legitimate joins work, nonowners never receive stored invitations, and invitation rotation invalidates old codes.

## Controls examined without a confirmed bypass

- Generic writes explicitly reject the `users` collection (`server.cjs:230–231`), preventing a client from setting password/recovery fields through CRUD. User reads return an allowlisted public representation; team invitation values are owner-scoped.
- Protected API routes require a resolved session. Generic reads and writes check workspace membership; assignment preview/apply and administrative upgrade routes require admin access. Assignment/picklist revisions and report retry-key conflicts are enforced server-side.
- Cookies are HttpOnly, SameSite Strict, and Secure in production (`server.cjs:60`). Write requests with a foreign Origin are rejected (`server.cjs:67–70`). Passwords use salted scrypt; session-file keys are token hashes. Disabled users are rejected on session resolution.
- Static serving uses only `dist` (`server.cjs:343–344`); private integration/session/push files are located beside `DB_FILE`. Deployment archives tracked source paths (`deploy.sh:91`), rather than copying the working directory or current database. This does not prove historical Git secrets or independently misconfigured reverse proxies are safe.
- Database replacement uses a temporary file, file fsync, rename, and restrictive file modes (`database.cjs:49–62`). Schema upgrades preserve a backup. There is no multi-process transaction lock: keep one database writer and verify independent off-host backups/restores before launch.
- Notification subscriptions allowlist HTTPS browser push hosts (`notification-service.cjs:11–18`). The scheduler rereads the database after awaited push delivery (`notification-service.cjs:110–111`), avoiding a stale database overwrite at that boundary.
- Active app code reviewed uses React text escaping and restricted raster data URLs; no `dangerouslySetInnerHTML` sink was found in the inspected active modules. PDF/PPTX exports write text through libraries. CSV exports quote cells and prefix direct formula-start characters (`src/argus/history-model.js:32`); whitespace/control-character formula variants should be tested in native spreadsheet applications before claiming comprehensive formula protection.
- Offline restoration verifies a current online user and team membership when reachable, and scopes drafts/queues/cache by account/team. Offline cached access is a device-access tradeoff; server revocation cannot erase an already downloaded offline copy. Document shared-device sign-out and retention behavior.

## Additional release hardening / verification

Assignment optimization is synchronous and its work scales with stored event teams/matches (`assignment-service.cjs:72–76,106–118`). Owners may create event data through the generic API. Bound schedule/team sizes and rate-limit expensive preview/analytics routes to contain abusive authenticated tenants; benchmark realistic maximum events without testing hostile loads against production.

Verify deployed HTTPS, trusted proxy behavior, production Secure cookies, no public origin port, request-size limits, filesystem access, backup restoration, and dependency fixes separately. CSP/HSTS were not established by this source pass; coordinate edge/application headers rather than asserting their production absence. Public registration, minors' privacy, required policies, operator identity/contact, third-party terms and commercial media rights need separate review. This source review is not a penetration test, legal opinion, certification, or guarantee against incidents or claims.

No exploit traffic or new automated tests were run in this read-only pass. Existing test coverage and final release test results must be attached by the coordinating release review. Re-review authentication after recovery/username changes and abuse-control fixes land.
