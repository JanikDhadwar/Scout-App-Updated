# Argus 5.11.0 — public readiness engineering

Completed local implementation and verification on 2026-10-28, continuing the work started 2026-10-27. Package and lockfile use 5.11.0. Main remains unpushed; no production records or private configuration were changed.

## Changes

- Bounded asynchronous password hashing and state revalidation prevent authentication work from blocking the event loop or overwriting intervening scouting/account changes.
- Safe request limits, security headers and correlation-only error logging reduce exposed request data. Historical attribution survives an identical submission retry after account rename.
- Persistent storage fails closed for missing/corrupt/future/symlink databases, uses durable atomic writes and enforces a single server writer. Private backup/verify/restore tooling preserves embedded evidence and refuses existing restoration targets.
- Service workers retain public build assets without shared private-image caching. Draft commits/failures are handled before an app-update reload; compatible install icons are provided.
- Role/release read invalidation can refetch once without returning stale privileged data. Phone More focus, accessible names, sharing-save confirmation and stale authenticated-route redirects are corrected.
- CSV formula prefixes with ignored whitespace/control characters are neutralized. The fix has pinned isolated baseline-versus-patch evidence.
- Optional admission pauses/caps let an operator slow expansion while retaining existing sign-in, joining and report upload. No production policy or cap was selected automatically.
- Unused dependencies were removed and license notices made reproducible with fourteen pinned supplements. One notice gap remains; the fresh full audit's unpatched development-only low advisory chain is recorded instead of hidden.
- Repeatable multi-team workloads, cross-engine fixture checks, automated accessibility checks, CI gates and operating/field/recovery/threat-model documentation are included.

## Validation and limits

The [evidence report](public-readiness-evidence.md) contains commands, results, exact local artifact paths, performance measurements, failed diagnostic cases and limitations. The suite has 177 unit/API tests, up from 122 before this work, and passes on Node 24 and 26. Edge (production mode), Chromium and WebKit each pass 25 workflow checks; the automated 47-state accessibility audit passes. PDF pages and required responsive widths were inspected. Physical devices, native PowerPoint, manual accessibility, production operations and independent-team pilots remain separate gates.

The larger synthetic dataset retained all 16,288 records with zero duplicate IDs/cross-team leaks. Request read reuse lowered observed report p95 from about 2.17 s to 1.71 s on this host, still above the proposed 500 ms target. This is not broad public-capacity approval.

Use the [release checklist](public-release-checklist.md) and [item ledger](public-readiness-ledger.md) for readiness tracking. **Unrestricted public launch is not approved**: operator/youth/privacy/licensing decisions, real infrastructure/recovery/monitoring, physical-device/manual checks, capacity/pilot evidence and explicit deployment authorization remain required.
