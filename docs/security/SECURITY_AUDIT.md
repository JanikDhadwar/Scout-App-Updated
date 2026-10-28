# Argus security audit

Audit date: 2026-10-28. Baseline: `4c96481` (Argus 5.11.0). Frameworks: OWASP ASVS 4.0 and OWASP Top 10 2021. This is a source-assisted, isolated security review, not a guarantee that Argus is secure. No production data or write endpoint was used.

## Architecture and trust boundaries

The active client is React/Vite (`src/frc-scout-local.jsx`). The inactive Firebase prototype remains tracked but is not imported by the active entry point. Express serves the static build and a JSON API. Authentication uses an opaque HttpOnly cookie backed by a private hashed-token session file. The JSON database and private configuration live outside release directories. Browser drafts and pending reports live in IndexedDB and remain readable to anyone with access to that browser profile.

Cloudflare is a separate trust boundary. Harmless requests from the audit environment received a Cloudflare 403 challenge, so deployed application headers, cookies, version, proxy trust and origin isolation were not observable. They remain production verification requirements.

## Endpoint inventory

| Access | Endpoints | Enforcement |
| --- | --- | --- |
| Public | `GET /api/health`, `GET /api/release`, `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/reset-password`, `POST /api/auth/mfa/verify`, static app routes | Body limits, aggregate/address limits, safe errors; MFA challenge is server-side and short-lived |
| Authenticated account | `GET /api/auth/me`, logout, create/join/archive/restore team, deactivate, recovery code, username, MFA status/enroll/recovery/disable | Current enabled user resolved from private session; reauthentication on sensitive account actions |
| Workspace member | live revision, active-event refresh, integration status/check, TBA/Match13/Statbotics reads, handoffs, permitted analytics/evidence, practice, preferences, notifications/push, scoped generic reads and permitted writes | Membership is resolved from server database; client workspace IDs are not trusted alone |
| Admin/Owner | assignment preview/apply/reconcile, allocations, Admin overview/activity/reports/coverage, form and report state management, sharing approval | `requireAdmin` or Owner checks in services and generic route policy |
| Owner or step-up | integration-secret configuration, role changes, join-code rotation, ownership-transfer request; accepting ownership when mandatory MFA is enabled | Owner role plus MFA step-up when enrolled; password reauthentication where applicable |
| Retired | analyst endpoints, destructive legacy event transition, legacy assignment generator | Explicit 409/410 responses; no compatibility bypass |

Generic `GET /api/:store{/:id}` and write routes are allowlisted by store and apply store-specific field, membership, role, revision and identity rules. The complete executable route list should be regenerated from `server.cjs`, `upgrade-routes.cjs`, `account-security.cjs`, and `notification-service.cjs` for every release.

### Route groups included in the inventory

- Account: login, signup, reset-password, MFA verify/status/enroll/recovery/disable, me, logout, username/recovery/join-code changes, create/join/archive/restore team and deactivate account.
- Live/integrations: workspace revision, active-event refresh, integration status/configure/check, allowlisted TBA paths, Match13 resources, Statbotics rankings, and retired analyst status/ask.
- Scouting: form submission counts, handoff list/context/create/respond, non-destructive event transition preview/apply, practice list/create, preferences read/update, and generic scoped stores.
- Assignments/Admin: assignment plan read/preview/apply/reconcile, allocation patch, retired generator, Admin overview/coverage/members/activity/reports, membership remove/role, ownership transfer request/list/respond, report remove/restore/review, event analytics/evidence/sharing.
- Notifications: inbox, mark-read, push status/subscribe/unsubscribe.
- Static/fallback: release, health, static build files, SPA GET fallback, API 404 and legacy unprefixed-store rejection.

## Findings

### ARGUS-SEC-001 — Provider HTML rendered through React escape hatch

- Severity: Medium (tracked inactive component; High if reactivated unchanged)
- OWASP: A03 Injection; ASVS V5
- Evidence: baseline `src/frc-scout-app-FireB.jsx` lines 2265 and 2368 used `dangerouslySetInnerHTML` with `liveData.status.overall_status_str`.
- Root cause: provider status formatting was treated as trusted HTML.
- Impact: reactivating that entry point could permit stored/provider-controlled script-capable markup in the application origin.
- Remediation: replaced both sinks with React text rendering and `white-space: pre-wrap`. Added a source-wide regression test rejecting `dangerouslySetInnerHTML` and direct `.innerHTML` assignments.
- Status: Fixed locally; production unaffected because the component was inactive.

### ARGUS-SEC-002 — Image validation trusted MIME declaration and encoded length

- Severity: Medium
- OWASP: A03 Injection, A04 Insecure Design; ASVS V5/V12
- Evidence: baseline `submission-service.cjs:28` accepted a matching data-URL regex and character limit without decoding or checking file signatures/dimensions.
- Root cause: syntactic validation was used as content validation.
- Impact: malformed or spoofed media and decompression-sized images could consume storage/browser resources or reach unsafe rendering/export paths.
- Remediation: canonical base64 decoding, decoded-byte limit, PNG/JPEG/WebP signatures/container checks, dimension and pixel budgets. SVG/HTML and MIME spoofing are rejected.
- Status: Fixed locally with regression tests. WebP VP8/VP8L dimensions remain browser-decoder checked; the RIFF length/type is validated server-side.

### ARGUS-SEC-003 — Privileged accounts had no application MFA

- Severity: Medium
- OWASP: A07 Identification and Authentication Failures; ASVS V2
- Evidence: baseline supported password and one-time password-recovery codes but no second factor.
- Root cause: custom authentication initially provided a single factor.
- Impact: a stolen Owner/Admin password could expose integration settings and privileged workspace controls.
- Remediation: optional TOTP, AES-256-GCM encrypted private secret storage, single-use hashed recovery codes, time-step replay prevention, bounded challenges, session rotation, and MFA step-up for sensitive privileged operations. Mandatory rollout is off by default and fails startup if existing privileged accounts are unenrolled.
- Status: Fixed locally as an opt-in control. Operator enrollment, key custody and recovery rehearsal remain required.

### ARGUS-SEC-004 — Development dependency advisory chain

- Severity: Low
- OWASP: A06 Vulnerable and Outdated Components; ASVS V14
- Evidence: `npm audit --omit=dev` reports zero vulnerabilities. Full `npm audit` reports four Low entries through `vite-plugin-pwa` → Workbox → Rollup node resolution → `deepmerge` (GHSA-gcqx-w48m-w2h4).
- Impact: affected code is build-time/development-only in the reviewed dependency graph. No production runtime path was identified.
- Remediation: do not apply npm's unsafe downgrade recommendation. Track an upstream-compatible release, keep lockfile integrity and CI audits, and reassess reachability on dependency changes.
- Status: Open, accepted temporarily with documented reachability.

### ARGUS-SEC-005 — Production edge/origin controls not independently verified

- Severity: Medium operational risk
- OWASP: A05 Security Misconfiguration; ASVS V14
- Evidence: `https://6390scout.app`, `/api/health`, and `/api/auth/me` returned Cloudflare 403 to the audit environment. No bypass attempt was made.
- Impact: source configuration cannot prove Secure-cookie behavior, HSTS/CSP delivery, trusted proxy correctness, WAF rules, TLS, origin-port isolation, or deployed revision.
- Remediation: follow `PRODUCTION_SECURITY_CHECKLIST.md` from an authorized operator network and retain redacted evidence.
- Status: Unverified; blocks an unrestricted public-readiness claim.

### ARGUS-SEC-006 — Offline copies cannot be remotely revoked

- Severity: Medium residual risk
- OWASP: A01 Broken Access Control; ASVS V8
- Evidence: IndexedDB intentionally retains prepared data, drafts and queues for competition use. Online role removal invalidates future server access but cannot erase a disconnected device.
- Impact: a lost/shared device may retain previously downloaded team data.
- Remediation: preserve server revocation, account-scoped caches and update invalidation; publish shared-device, lock-screen, sign-out and device-loss procedures. Do not clear drafts automatically.
- Status: Accepted product tradeoff; documented and regression-tested.

### ARGUS-SEC-007 — Single-writer JSON capacity and availability ceiling

- Severity: Medium residual risk
- OWASP: A04 Insecure Design; ASVS V1/V14
- Evidence: the database is parsed and atomically rewritten as one JSON document. Writer locking prevents multi-process corruption, but large datasets increase event-loop and disk costs.
- Impact: resource exhaustion or storage failure can delay event-day submissions even without data corruption.
- Remediation: retain one writer, admission controls, bounded requests, verified backups and measured capacity limits. Do not claim broad multi-team capacity from short localhost tests.
- Status: Mitigated, not eliminated.

## Controls verified in source/tests

- Server-side role and workspace isolation, immutable report retry IDs, reversible report removal and audit history.
- Bounded asynchronous salted scrypt with legacy migration, generic login errors, bounded limiter maps, and password-change recovery session revocation.
- HttpOnly/SameSite Strict cookies; Secure in production; cross-origin browser writes rejected.
- CSP, frame denial, nosniff, referrer and permissions headers in Express.
- Private integration/session/push/MFA files excluded from Git and stored beside the database.
- SSRF allowlists for official data routes and browser push providers, with timeouts and redacted upstream failures.
- Durable atomic database writes, missing/corrupt/future-schema fail-closed behavior, symlink rejection and single-writer locking.
- Offline draft/queue durability, account scoping, immutable retries and cache invalidation after role/release changes.

## Limitations

No destructive production penetration test, credential validation, physical-device review, native PowerPoint inspection, full manual accessibility review, infrastructure scan or legal/privacy determination was performed. A source review and passing tests do not establish absence of vulnerabilities.
