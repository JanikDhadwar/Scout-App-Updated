# Public readiness evidence — Argus 5.11.0

Work started 2026-10-27; integration review continued 2026-10-28. Work remains local on main. No production database, private integration file, public deployment, external team message, or production backup was modified.

**Unrestricted public release remains not approved.** Local engineering work and evidence do not supply operator/legal decisions, real infrastructure access, physical-device testing, independent-team pilots, or deployment authorization.

## Delivered local changes

| Area | Concrete result | Reproducible evidence |
| --- | --- | --- |
| Password work | Async scrypt with two active/sixteen queued jobs, explicit overload, legacy format compatibility | `password-service.test.cjs`, `account-async.test.cjs`, `server-hardening.test.cjs` |
| Async authorization | Re-read current user/session/owner state after hashing; concurrent signup/recovery retain intervening records | Account async/security and server hardening tests |
| Server protection | 16 KB auth bodies; safe JSON errors; CSP, permissions policy, HTTPS-only HSTS, exclusive QA env source | Server hardening tests; browser CSP checks |
| Safe diagnostics | Server-generated request IDs and bounded error category/status; no raw exception/body/cookie/query logging | `request-logging.test.cjs` |
| Retry integrity | Lost-ack retry after username change retains original historical attribution; changed payload still conflicts | Server hardening test |
| Storage safety | Established DB missing/corrupt/future/symlink fail closed; unique synced atomic temporary writes and cleanup | `database-durability.test.cjs` |
| One writer | Private process lock, live-owner rejection, cautious crash/restart recovery, ownership-safe cleanup | `writer-lock.test.cjs` |
| Recovery tools | Explicit stopped-writer snapshot, checksum verification and restore to a new target; embedded media/unknowns retained, sessions excluded | `backup-recovery.test.cjs`, [recovery runbook](storage-recovery.md) |
| Request performance | One request-local synchronous snapshot; invalidate after await, attempted write or file identity change | `request-database.test.cjs`, measured workload below |
| Admission control | Optional signup/workspace pauses and retained-user/workspace caps; defaults preserve behavior; signup rechecks the cap after hashing | `admission-policy.test.cjs`; existing sign-in/join/upload remain available while admission is paused |
| Offline update | Await committed draft writes; preserve/retry failures and block unsafe reload | `draft-persistence.test.js`, `pwa-readiness.test.cjs` |
| Private cache boundary | Remove shared runtime image caching and clear legacy image caches without deleting IndexedDB data | Emitted-worker VM tests in PWA readiness test |
| PWA assets | Existing Argus icon rendered as raster/maskable/Apple icons; manifest/HTML metadata updated | Deterministic `generate-app-icons.cjs`, PWA readiness tests |
| Read invalidation | One fresh GET for tagged access invalidation; no retry for genuine 403/conflicts or account/workspace changes | `current-read.test.js`, existing offline-client security tests |
| Keyboard and semantics | More traps Tab in both directions and restores focus; named groups and visible-label-compatible controls | Browser More checks and automated accessibility suite |
| CSV safety | Neutralize formula prefixes hidden behind whitespace/control characters in answers, metadata and headers | `history-model.test.js` |
| Dependencies | Removed unused Firebase/JSON-server/CORS dependencies; retained inactive source as unsupported reference | Active build/tests, manifest/lockfile and dependency notices |
| License inventory | Fourteen exact-version/integrity-pinned offline supplements; one unresolved package remains explicit | `dependency-notices.test.cjs`, [notice evidence](dependency-notices-public-readiness.md) |
| Continuous checks | Added Windows Edge, accessibility and isolated workload job to existing pinned/least-privileged CI | `.github/workflows/argus-check.yml`; hosted job not run by this local change |
| Operations | First-event/device guide, roles/threat model, incident/support/privacy process, backup/release procedures | [field guide](device-support-and-field-guide.md), [operations handbook](public-operations-handbook.md), [threat model](public-threat-model.md) |

## Candidate commands

Run in `Clasue-scout-app` unless a repository-root command is shown. Current final integration results are recorded below and must not be inferred from an earlier release.

- `npm test`: **177 passed, zero failed/skipped**, exit 0. Local Node v26.12.0, Windows x64. Log: `readiness-tests-final.log` (ignored local file).
- `npm run build`: exit 0, including generated PWA worker and version metadata. Log: `readiness-build-final.log`.
- `npm run lint:active`: exit 0. Root verification scripts are checked separately using the explicit app ESLint configuration from repository root.
- `npm run notices`: deterministic local generation; **one unresolved gap**, `https@1.0.0`. No license or copyright holder text was invented.
- `npm run test:browser` with Edge: **25 passed**, exit 0, zero uncaught browser errors or CSP violations. Chromium: **25 passed**, exit 0, zero uncaught browser errors or CSP violations. Final artifact directories are `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-QVPq49` and `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-Y1nZY4` respectively. WebKit and production-mode follow-up runs are recorded after completion below; earlier failed diagnostic runs are not counted as passes.
- `npm run test:accessibility`: **47 states, zero automated WCAG rule violations, zero generic-name failures, zero missing controlled IDs, zero page errors**, exit 0. Artifact directory: `C:/Users/Janik/AppData/Local/Temp/argus-accessibility-qa-jbfCgt`. Contrast/SVG/clipped-cell/ARIA cases classified as incomplete remain manual review, not automatic passes.
- All six required dashboard screenshot widths (1440, 1280, 1024, 768, 390, 360 CSS px) were visually inspected. No clipping or document overflow was observed in those layouts; the 1440 capture briefly shows a lazy chart loading, with loaded charts visible at subsequent widths. The suite also captures/checks the other primary routes at all six widths.
- The final downloaded PDF was rendered with Poppler and all ten pages visually inspected: readable text/charts, no missing or clipped content in the synthetic fixture. Optional font substitution warnings were emitted. This is not PDF accessibility conformance or native PowerPoint rendering evidence.
- The full 177-test suite also passes on the bundled **Node v24.22.1** runtime (exit 0), in addition to local Node v26.12.0. Hosted Node 22 CI is configured but was not run through GitHub because no push was authorized.
- A bounded current tracked-file signature scan found no matching Groq/GitHub/OpenAI project token or private-key header. This does not clear all secret formats, Git history, untracked/private files, or earlier disclosures.

## Fresh advisory disposition

The 2026-10-28 full dependency audit reports **four low-severity entries arising from one root `deepmerge` advisory** in the development-only `vite-plugin-pwa → workbox-build → @rollup/plugin-node-resolve → deepmerge` chain. There are no moderate/high/critical findings in that result. A production-only audit (`npm audit --omit=dev`) reports **zero known advisories**. Earlier zero-advisory reports describe their earlier scan times and are not the current full-tree result.

The [reviewed advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) lists no patched version. Its affected merge operation is used here during builds of trusted local configuration, not by Express report/authentication endpoints. No untrusted report or team input is fed into this build-time merge. The finding remains tracked; no claim of dependency immunity is made. Do not accept npm's suggested major downgrade to an obsolete PWA plugin merely to remove an advisory count. Recheck for a compatible upstream fix and reassess if the build ever processes external configuration. Logs: `readiness-audit-final.log` and `readiness-audit-production.log`.

## Measured local workloads

Both larger runs used sixteen synthetic workspaces, three scouts each, 16,000 seeded reports, 288 new reports, concurrency sixteen, and about 10.7 MB final JSON data. They also exercised scoped revision/health reads, forty-eight identical retries, forty-eight conflicting retries, and negative cross-team reads/writes. Short localhost runs are not event-day soaks or production capacity tests; concurrent local tooling and OS scheduling were not controlled.

| Measurement | Before request read reuse | After request read reuse |
| --- | --- | --- |
| Write phase | 45.792 s | 35.998 s |
| Confirmed new reports/s | 6.29 | 8.00 |
| Report p95 | 2168.73 ms | 1713.22 ms |
| Report p99 | 2308.82 ms | 1811.47 ms |
| Final reports | 16,288 | 16,288 |
| Duplicate IDs / cross-team leaks / workload errors | 0 / 0 / 0 | 0 / 0 / 0 |

The observations support a useful local improvement, not a universal percentage guarantee. The proposed 500 ms p95 target remains unmet in this larger workload. Whole-file synchronous JSON persistence remains a capacity constraint; public admission/capacity needs ratified requirements, representative production hardware/network/resource measurements, fair shared-IP abuse testing, media volume, headroom and soak evidence. Do not claim all-team concurrency from these numbers.

Artifacts: before `C:/Users/Janik/AppData/Local/Temp/argus-readiness-load-HT7pdH/result.json`; after `C:/Users/Janik/AppData/Local/Temp/argus-readiness-load-stG5wU/result.json`. The smaller initial eight-team/twenty-four-scout workload retained 1,088/1,088 reports and zero errors/leaks/duplicates; its lower latency does not supersede the larger constraint.

## Diagnostic failures fixed or kept open

- Initial source review found synchronous password work, stale async mutation hazards, a rename/retry attribution conflict, missing-established-DB resets, temporary-file/lock edge cases, unsafe shared image caching, update-before-draft-commit, CSV prefix variants and raw error-message logging. New regression tests failed before their fixes and pass in the integrated suite.
- Chromium's preview-image assertion raced image decoding. The test now waits for actual completed image loading; broken images still fail.
- WebKit worker-controlled fetches bypass Playwright routing. Mock-provider tests now use worker-blocked contexts, while public offline reload and authenticated draft/reconnect tests run separate real worker-enabled contexts. This preserves real offline evidence instead of disabling it to get a pass.
- Pit refresh intentionally pauses hidden pages. The multi-scout test brings the waiting scout back to the foreground before expecting a live update.
- Signup already authenticates. The account login test explicitly logs out after API setup before testing the sign-in interface, preventing a race with correct session restoration.
- Login test setup now waits for initial requests to settle before changing routes. Synthetic pit-limit setup supplies its intended event explicitly; existing drafts correctly retain their original event instead of being overwritten when the active event changes.
- The sharing form is intentionally remounted when its revision advances. Its save confirmation originally lived inside that form and disappeared during the successful refresh. The failed Edge case reproduced this; the confirmation now lives above the revision-keyed form, scoped to its event, and the integrated Edge/Chromium checks pass.
- A pending authenticated-route effect could overwrite a newer hash navigation with its dashboard redirect. It now verifies the actual current hash before redirecting. The failing WebKit welcome/settings cases pass after this guard.
- Firefox launch fails with `spawn UNKNOWN` on this Windows host under both Node v26 and the bundled Node v24 runtime. No Firefox pass, physical Safari/iOS pass, or browser security bypass is claimed.
- Native PowerPoint rendering has not been established on this host; download/structure tests are not native slide-rendering evidence.

## Remaining release gates

1. Operator identity/location, monitored public contacts, named release/responders, intended ages/countries, youth/guardian safeguards and reviewed privacy/terms notices.
2. Approved retention, real erasure/anonymization/request handling, backup expiry/deletion replay and verified third-party processing/data/brand permissions.
3. Argus/contributor licensing and the one unresolved dependency notice. No external maintainer/team was contacted.
4. Real HTTPS/proxy/origin/firewall/ACLs, production monitoring/alert delivery, encrypted off-host backup scheduling/retrieval and timed real-environment restore/rollback.
5. Physical iPhone/iPad/Android/Mac/Chromebook/other advertised device testing, native PowerPoint, screen readers/zoom/touch trials and manual accessibility findings.
6. Ratified capacity and budgets, production-like long/media/outage/abuse tests, independent-team event pilots and adoption/support evidence.
7. Named go/no-go review and separate explicit authorization to push/deploy the exact release candidate.

Local documentation/tooling is ready for those activities. They remain open because access, independent people, actual devices or policy decisions are required; local tests cannot substitute for that evidence.

## Final follow-up verification

- Production-mode Edge: **25/25 passed**, zero uncaught browser errors/CSP violations, including the explicit Secure + HttpOnly + SameSite Strict session-cookie assertion. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-qvYuiB`.
- WebKit on Windows: **25/25 passed**, zero uncaught browser errors/CSP violations, including real worker-enabled offline reload/reconnect contexts, More focus containment/return, live limits, event context, automatic official refresh and account recovery. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-7CVd68`. This remains WebKit engine evidence, not physical Safari/iPhone/iPad certification.
- Final Chromium rerun: **25/25 passed**, zero uncaught browser errors/CSP violations. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-vm2J6Q`.
- Final accessibility rerun after the route/admission fixes: **47 states, zero violations/generic-name failures/missing controlled IDs/page errors**, exit 0. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-accessibility-qa-uYVcJf`; incomplete manual checks remain open.
- Final generated release: version **5.11.0**, build ID `a30cfb96-9089-49e3-bae4-f6059e2ff8f3`. Revision is null because this is an uncommitted local candidate, not a deployed Git revision. Package and both lockfile version entries agree.
- Independent late-change review reported no actionable findings and reran twelve focused admission/current-read/request-database tests successfully. This review does not certify physical devices, legal decisions or production operations.
- Pinned CSV baseline-versus-patch runtime validation: **eight checks on both revisions**, expected original/variant failures on the base, clean behavior/regression/security/suite results on the patch, assessment complete with no findings/gaps and human review still required. See [differential evidence](security-patch-validation.md).
- The [item ledger](public-readiness-ledger.md) accounts for all 283 original requirements and explicitly preserves wider unverified conditions. A local pass is not release approval.
