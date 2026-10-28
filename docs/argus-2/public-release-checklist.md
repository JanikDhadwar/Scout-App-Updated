# Argus public release checklist

Prepared 2026-10-27 for public availability across FRC teams and supported devices. Engineering evidence updated 2026-10-28 for the local 5.11.0 candidate: [results and remaining gates](public-readiness-evidence.md).

**Release decision: not approved by this document.** This is a readiness checklist, not a completed audit. Checkboxes require evidence for their full acceptance condition; partial local evidence does not clear physical-device, legal, production or pilot requirements. Do not announce unrestricted availability until the gates below are signed off.

## How to use this checklist

Each numbered section is a release gate. Assign a named owner, reviewer, target date, status, and evidence link to each gate in the sign-off register. Break individual boxes into tracked issues when implementation is needed. Mark a box complete only after its acceptance condition has evidence tied to a version, commit, date, and environment. Record browser/OS/device versions for device evidence. Keep real user data, secrets, recovery codes, and private infrastructure details out of public evidence.

The [item ledger](public-readiness-ledger.md) records a disposition for all 283 original items. Checked local engineering requirements and excluded conditional AI items do not clear their larger legal, physical-device, operational or public-capacity gates.

All items apply before unrestricted public release unless explicitly conditional. A conditional item needs a written reason and proof that the corresponding feature or audience is excluded. Optional features can be disabled on the server and removed from advertised scope; core requirements such as team isolation, report durability, accessibility, and operational recovery cannot be waived by relabelling the release a beta. A changed release candidate requires rerunning affected checks.

“All devices” means a published, tested support matrix for web and installed PWA usage. It cannot mean every historical browser or a native App Store/Play Store app. “All FRC teams” means independent teams can onboard and use isolated workspaces at the advertised capacity; it does not make their scouting data public.

## Current evidence and known gaps

Repository context inspected for this checklist:

- Active React app: `Clasue-scout-app/src/frc-scout-local.jsx`; shared UI: `Clasue-scout-app/src/argus/workspace.css`; server: `Clasue-scout-app/server.cjs`; shared calculations: `Clasue-scout-app/src/argus/analytics.js`.
- The server remains a single-writer JSON design. The 5.11.0 work adds a process guard, bounded asynchronous password hashing, a 16 KB authentication body limit, safe diagnostics and request-local read reuse. Reports retain the larger media body limit. Larger local workloads still exceed the proposed p95 latency target; this document does not establish a safe public capacity.
- `release-readiness-5.9.0.md` records unresolved privacy/contact/children's-account decisions, dependency notice review, and production infrastructure checks. Its historical test results are not proof for a future candidate.
- `live-scouting-5.10.1.md` records 122 passing unit/API tests and 25 fixture browser checks for that snapshot, plus six viewport widths. Native PowerPoint rendering was unavailable. Actual cross-platform and fleet-scale readiness remains unproven by those results.
- `public-notices-draft.md` remains a draft. It describes retired analyst endpoints, while AGENTS.md defines safeguards for any authorized optional Groq integration. Check actual shipped behavior before publishing notices or offering the feature.
- The 5.11.0 PWA includes raster/maskable/Apple icons, prevents unsafe draft-update reloads and removes shared private-image caching. Installation and storage behavior still require physical-device verification across the support matrix.

See also [prior release review](release-readiness-5.9.0.md), [security review](release-security-review.md), [dependency review](release-supply-chain-review.md), [notice draft](public-notices-draft.md), and [live scouting verification](live-scouting-5.10.1.md). These are starting evidence, not cleared launch gates.

## 1. Release scope and responsibility

- [ ] Name the actual service operator, accountable release owner, technical maintainer, privacy contact, and competition-day responder; confirm backup coverage when a student maintainer graduates or is unavailable.
- [ ] Define launch countries, intended ages, languages, supported devices, supported browsers, and web/PWA distribution. Review new countries before expanding the advertised audience.
- [ ] Publish exactly which features are available: match scouting, pit scouting, schedules, assignments, reports, comparisons, picklists, presentations, exports, and any integrations.
- [ ] State which features require internet, which work offline, and which require prior device preparation. First-ever offline sign-in or uncached event access must not be promised.
- [ ] Decide whether one person can belong to multiple teams, whether a team can have multiple workspaces/events, and how duplicate team claims are resolved.
- [ ] Define expected registered teams, concurrently active teams, scouts per team, reports per match, attachments per report, retained seasons, and peak event weekends.
- [ ] Choose the launch capacity from measured results and resources. Establish waitlisting/admission limits before capacity is exceeded.
- [ ] Define free/paid scope, quotas, ownership, and support expectations honestly. If payments are excluded, ensure the public flow contains no payment dependency.
- [ ] Inventory every public route and API, including legacy URLs, health/version endpoints, downloads, integrations, and administrative update functions.
- [ ] Establish severity definitions: data loss, cross-team disclosure, account takeover, or inability to scout on a supported device blocks release immediately; lower-severity exceptions need owner, mitigation, expiry, and review.

Evidence: approved scope, ownership roster, support policy, capacity assumptions, and route inventory.

## 2. Team signup and ownership

- [ ] A new team unfamiliar with Argus can create an account, establish a workspace, set up an event/form, invite a scout, and submit its first real report using only public instructions.
- [ ] Validate team numbers without permanently hardcoding current number ranges; explain whether a number is verified, claimed, or simply entered. Handle offseason, practice, and unavailable official lookups.
- [ ] Prevent duplicate or impersonated ownership claims from silently exposing existing records. Provide a documented dispute and ownership-recovery process with human verification.
- [ ] Confirm signup, login, and team creation cannot grant site-administrator privileges through submitted fields or modified requests.
- [ ] Invitation codes have adequate entropy, bounded guessing attempts, owner-only access, and rotation/revocation. Old invitations stop working after rotation.
- [ ] Join screens identify the intended team/workspace before confirmation without exposing private roster or scouting data.
- [ ] Existing members keep access after invitation rotation; disabled/removed members lose online access promptly.
- [ ] Assign each role intentionally. The default member gets the minimum permissions required; analytics or admin access follows explicit policy.
- [ ] Test users with memberships in two teams and several events. Switching scope changes all reads, writes, exports, notifications, and cached views consistently.
- [ ] Handle the last owner leaving, owner deactivation, team archiving, restoration, and ownership transfer without orphaning a workspace or destroying reports.
- [ ] Publish acceptable use, abuse reporting, account suspension, appeal, and team-claim dispute procedures.

Evidence: independent onboarding exercise and negative API tests for claims, invitations, and role assignment.

## 3. Account security and recovery

- [ ] Verify salted password hashing, password input bounds, constant-time secret comparisons, and migration of legacy hashes without resetting user identities.
- [ ] Benchmark login/signup hashing under abuse. Remove event-loop blocking or enforce tested bounded work/concurrency so authentication cannot stall scouting writes.
- [ ] Test aggregate, address, account, and global rate limits for login, signup, recovery, joining, uploads, expensive queries, and integration calls.
- [ ] Test many scouts sharing one venue/school IP: one abusive account must not trivially lock the entire legitimate audience out. Document global protection tradeoffs.
- [ ] Verify password reset/recovery cannot enumerate accounts, replay a consumed code, reveal stored secrets, or preserve revoked sessions.
- [x] Document that recovery currently depends on a previously saved recovery code unless a different verified process is implemented. Do not advertise email reset without working delivery and ownership verification.
- [ ] Protect username/password/invitation changes with appropriate recent authentication. Preserve stable IDs, memberships, historical report attribution, drafts, and pending reports.
- [ ] Test session expiry, browser restart, logout, simultaneous devices, disabled users, password changes, and recovery-based session revocation.
- [ ] Verify production cookies are HttpOnly, Secure, correctly scoped, and use the intended SameSite behavior through the real public proxy.
- [ ] Validate restored cached sessions against the matching user and current membership before online access resumes. Never grant current permissions merely from an old cached role.
- [ ] Require strong protection for hosting, repository, DNS, deployment, backup, and operator accounts, including MFA and securely stored recovery methods.
- [ ] Review protection for team-owner and service-admin accounts; implement stronger authentication where the risk review requires it, or document a reviewed mitigation and rollout deadline.

Evidence: authentication/recovery abuse tests and production cookie inspection with secrets redacted.

## 4. Server authorization and team isolation

- [ ] Maintain a role/action matrix covering anonymous visitors, scouts, analysts if supported, admins, owners, removed members, and service operators.
- [ ] Exercise every protected endpoint with no session, an expired session, another team's session, and each insufficient role. Hiding a control is not authorization.
- [ ] Attempt cross-team reads/writes by altering workspace, team, event, form, report, assignment, attachment, picklist, and user IDs in paths, bodies, and query strings.
- [ ] Verify list/search/aggregate/count/revision endpoints cannot reveal records, membership, activity, or counts from unrelated teams.
- [ ] Verify exports, thumbnails, full attachments, legacy routes, integrations, push delivery, and update/admin routes enforce the same boundaries.
- [ ] Reject attempts to change protected ownership, identity, revision, credential, and integration fields through generic CRUD or bulk requests.
- [ ] Sanitize all user representations. Browser responses, errors, exports, telemetry, and HTML source contain no password hashes, saved keys, session tokens, or recovery hashes.
- [ ] Invalidate read caches after confirmed role changes while preserving original-account drafts and queues. Test open tabs during a downgrade or removal.
- [ ] Document offline revocation limits: data already downloaded to an offline device cannot be remotely recalled. Prevent further online access and cross-account display on reconnect.
- [ ] Test archive/restore and member removal without accidental data transfer to another team, ID reuse, or record deletion.

Evidence: endpoint permission matrix and automated cross-team negative tests against disposable databases.

## 5. Privacy, youth safeguards, and international availability

Legal applicability depends on the operator, activities, and audience. Obtain qualified review for the actual launch scope. The [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) flags an amended rule and directs readers to the revised requirements; do not rely solely on older FAQ text. The [Canadian OPC children's privacy guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/protection-of-children-for-businesses/childrens-privacy-code/children-code-final-report-2026/) emphasizes age-appropriate consent. These sources support the need for review, not a conclusion that Argus satisfies every jurisdiction.

- [ ] Confirm the responsible operator's legal identity/location and the countries where hosting, backups, support access, proxying, and subprocessors occur.
- [ ] Obtain review of applicable Canadian federal/provincial, US, EU/EEA, UK, and other launch-market requirements as relevant; document conclusions and any audience restrictions.
- [ ] Resolve under-13 and other age-related requirements before unrestricted all-ages signup. Implement an appropriate age/guardian process if required, or enforce the reviewed audience restriction.
- [ ] Where required, verify consent before relevant collection, record it securely, and support guardian review, withdrawal, deletion, and re-consent. A team join code or ordinary checkbox is not verified parental consent.
- [ ] Minimize youth data: avoid requesting full names, exact birth dates, contact details, school details, or location unless a documented purpose and lawful process require them.
- [ ] Publish readable privacy and terms notices identifying the operator, contact, collection purposes, team visibility, third parties, retention, requests, and offline device storage.
- [ ] Explain that public team statistics and private scouting observations are different. Keep private reports, scout identities, notes, and team strategy private by default.
- [ ] Set actual retention periods for accounts, submissions, media, audit logs, sessions, notifications, caches, integration logs, and backups; implement expiry where promised.
- [ ] Provide verified access, correction, export, and deletion request procedures with tracked response deadlines and escalation.
- [ ] Implement and test erasure/anonymization decisions across historical scout attribution, reports, media, search/derived views, integrations, and backup expiry. Deactivation or archiving must not be called full deletion.
- [ ] Prevent erased data from silently returning after a restore; keep a protected deletion ledger or equivalent replay process where appropriate.
- [ ] Review free-text/photo misuse, personal information about other people, metadata/location leakage, and moderator access. Give clear reporting/removal instructions.
- [ ] Review cookie/storage disclosures and consent requirements for any nonessential telemetry. Inventory third-party scripts; omit unnecessary advertising and tracking.
- [ ] Review push subscription handling and any external AI processing separately. Record vendors, regions, data fields, retention, and agreements where applicable.
- [ ] Publish monitored privacy/security/deletion contacts and verify a test request reaches an accountable person.

Evidence: reviewed notices, processing inventory, youth-flow tests, retention/deletion exercise, and operational request handling.

## 6. Application and infrastructure security

Use the [OWASP Application Security Verification Standard](https://asvs.owasp.org/) as a traceable verification framework; select applicable requirements and record results. A scanner alone does not establish security.

- [ ] Update the threat model for public anonymous traffic, malicious members, compromised owners, shared devices, uploads, integrations, and deployment access.
- [ ] Validate types, lengths, enums, nested depth, arrays, IDs, timestamps, and per-route body limits before expensive processing. Reassess the current global 10 MB JSON limit.
- [ ] Test stored/reflected/DOM injection through team names, form questions, answers, notes, filenames, imported schedules, notifications, and exported content.
- [ ] Review CSRF, Origin checks, CORS, content types, cookie settings, and expected handling of requests without an Origin header.
- [ ] Test path traversal, unauthorized static/private files, malformed encodings, prototype pollution, and unsafe object merges on imports/CRUD.
- [ ] Apply appropriate content security, anti-framing, MIME-sniffing, referrer, and permissions policies; test compatibility with PWA, downloads, and drawings.
- [ ] Restrict outbound integration hosts and paths; test SSRF, unexpected redirects, oversized responses, timeouts, and injected upstream content.
- [ ] Scan current files, release archives, generated assets, and relevant Git history for secrets. Rotate exposed keys; do not assume deleting a file revokes a credential.
- [ ] Keep database, session, environment, and private integration files outside Git, static roots, release archives, and public backups. Apply restrictive filesystem permissions.
- [ ] Verify HTTPS, valid renewal, HTTPS redirects, public-origin configuration, firewall rules, origin restriction, and safe administrative access.
- [ ] Configure only the trusted proxy topology. Test real client IP handling and forwarded-header spoofing; use `ARGUS_TRUST_PROXY=loopback` only for the matching same-host topology.
- [ ] Review infrastructure patches, Node/runtime support, reverse-proxy limits, connection timeouts, disk limits, and denial-of-service controls.
- [ ] Have a qualified person review authentication, team isolation, uploads, and deployment boundaries; resolve critical/high findings and record dispositions for the remainder.
- [ ] Publish vulnerability reporting and a patch/notification response process with a monitored contact.

Evidence: requirement-to-test map, security findings, remediation results, proxy checks, and redacted configuration review.

## 7. Durable storage, migrations, and data integrity

- [ ] Prove atomic committed writes and crash recovery for the database and related private state; test process termination, disk full, permission failure, and malformed files.
- [x] Enforce a single database writer for the current JSON design. Do not run multiple replicas against the file or enable process clustering without a reviewed storage redesign.
- [ ] Measure whole-file reads/writes and event-loop stalls at the planned retained dataset size. Set a migration trigger and documented capacity limit before public scale exceeds it.
- [ ] If transactional storage is needed, migrate through rehearsed, versioned, record-preserving steps with a compatibility and rollback plan.
- [x] Preserve unknown fields, IDs, legacy reports, historical attribution, form snapshots, archived events, and relationships during all migrations/imports.
- [x] New events are additive. Archiving teams/templates retains reports and keeps archived forms reachable for unfinished drafts.
- [ ] Report records retain event, match, alliance, scout identity, type, assignment, question snapshot, and immutable submission ID.
- [x] Identical same-ID retries succeed idempotently; conflicting same-ID payloads return an explicit conflict without replacing original evidence.
- [x] Picklists and assignments require expected revisions; metric definitions use `analytics_revision`. Stale updates cannot silently overwrite newer work.
- [ ] Test concurrent submissions, imports, membership changes, event switches, live refreshes, and configuration writes for lost updates and partial state.
- [ ] Validate references and scoped uniqueness without rejecting legitimate legacy records; quarantine or explain invalid imports rather than silently discarding them.
- [ ] Record privileged changes and administrative actions with appropriate actor/time context; protect audit history and avoid logging report secrets or unnecessary personal data.
- [ ] Verify safe shutdown/restart and startup failure behavior; a broken DB must not silently become an empty newly initialized competition workspace.

Evidence: destructive fault tests on copies, migration comparison reports, concurrency tests, and documented storage limits.

## 8. Offline scouting and reconnection

- [x] Preserve IndexedDB name `scout-device-v1`, existing stores, draft keys, and original account/workspace scopes across upgrades.
- [x] Show a report as saved locally only after its storage transaction commits; test aborted transactions and quota failure without clearing the form.
- [x] Queue reports durably before upload. Mark synced only after server confirmation; show clear pending, uploading, confirmed, and conflict/error states.
- [ ] Prepare a device online, disconnect fully, close/reopen the browser or installed app, reload, resume a draft, and complete match and pit reports.
- [ ] Test no initial cache, missing form/media/schedule, private browsing, unavailable IndexedDB, low disk space, and denied persistence; explain limitations before data is at risk.
- [ ] Simulate connectivity indicators reporting online while DNS, TLS, the proxy, the origin, or one API is unavailable. Queueing and recovery remain truthful.
- [x] Drop the response after the server saves a report; reconnect and prove retry creates exactly one logical report.
- [x] A conflicted/rejected report stays recoverable and does not prevent unrelated uploads. Provide an understandable resolution or safe export path.
- [ ] Test multiple tabs, duplicate submit taps, app suspension, device lock, force-close, battery saver, and browser process eviction during save/upload.
- [ ] Test session expiry, password reset, membership removal, form archiving, report limits, and event changes while offline; keep original drafts and pending evidence.
- [ ] Sign out and use another account/team on the same device. No previous private content appears in the new scope; returning to the original account recovers its queue as policy permits.
- [ ] Pending-report recovery downloads contain complete metadata and media references/content needed for an actually tested recovery procedure.
- [ ] Reconnect with hundreds of queued reports, bounded retries/backoff, mixed failures, media, and slow responses. Avoid retry storms and starvation between teams.
- [ ] Document browser storage eviction, site-data clearing, uninstall/reinstall, and device-loss limits. Never promise local data survives explicit storage clearing.
- [ ] Verify foreground recovery on iPhone/iPad and Android. Do not depend on background sync or background execution where the platform suspends it.

Evidence: fault matrix, report ID/count reconciliation, queue recovery drill, and physical-device results.

## 9. PWA installation and safe updates

- [ ] Verify manifest name, start URL, scope, theme, standalone display, and icons on supported install targets; supply suitable raster/maskable/apple-touch assets where required.
- [ ] Provide accurate installation instructions for each supported platform, including browsers without an install prompt and managed devices where installation is blocked.
- [ ] Test installed launch, home-screen icons, deep links, browser back, refresh, orientation, and system navigation.
- [ ] Test first service-worker registration, returning clients, stale caches, offline launch, and an update available during a draft or upload.
- [ ] Update prompts retain unsaved edits and queues; defer/reload choices work without a reload loop or mixed old/new assets.
- [ ] Verify asset retention and cache behavior when an old tab is open during deployment; API responses and frontend versions remain compatible.
- [x] Ensure service workers never cache authenticated API responses or personal media across account/workspace boundaries. Review image-cache logout/revocation behavior explicitly.
- [x] Cache cleanup removes obsolete release assets without deleting IndexedDB drafts, queues, or required pending attachments.
- [ ] Test release version/build ID agreement, prompt visibility, failure recovery, and rollback from the previous deployed frontend.
- [x] Clearly separate PWA support from native store distribution. If native wrappers are later offered, add store review, permissions, signing, and update gates before advertising them.

Evidence: install/update recordings on supported physical devices and cache/IndexedDB inspection.

## 10. Device and browser support matrix

Fill in tested OS/browser versions and physical device models before sign-off. Emulated viewports do not prove Safari, touch, camera, storage, downloads, or installed-PWA behavior. Proposed baseline: current stable and previous major browser releases where supported by the OS; choose and publish exact floors based on device inventory and tests. Reassess the matrix each release.

| Platform | Minimum release evidence | Modes/input |
| --- | --- | --- |
| Windows | Edge (default QA), Chrome, Firefox | Browser; installed PWA where available; mouse/keyboard and touch if advertised |
| macOS | Safari, Chrome; other browsers if advertised | Browser; installed mode where offered; keyboard/trackpad |
| iPhone | Safari on physical small and larger phones; other advertised browsers | Browser and home-screen app; touch/camera/keyboard |
| iPad | Safari on physical tablet, including split view | Browser and home-screen app; touch and hardware keyboard |
| Android phone | Chrome on low/mid-range and modern physical devices | Browser and installed PWA; touch/camera |
| Android tablet | Chrome on physical tablet | Browser and installed PWA; touch/keyboard |
| Chromebook | Chrome, including a managed-device scenario | Browser; installed mode if allowed; keyboard/touch |
| Linux desktop | Chrome/Chromium and Firefox if advertised | Browser; keyboard/mouse |

- [ ] For every supported matrix row, complete signup/login, team join, draft save, match/pit submit, offline reload/reconnect, report viewing, and logout/account switching.
- [ ] Capture and inspect representative screens at 1440, 1280, 1024, 768, 390, and 360 CSS px; record no document-wide horizontal overflow.
- [ ] Test portrait/landscape, short-height screens, notches/safe areas, tablet split view, dynamic browser bars, and a visible software keyboard.
- [ ] Keep submit buttons, sync state, error text, modal actions, and bottom navigation reachable without covering the active field.
- [ ] Test long team/event/form names, large counts, empty states, loading, permission denial, network errors, and large datasets at every layout class.
- [ ] Verify touch drawing, scrolling versus drawing, mouse drawing, camera capture, photo selection, orientation, and file-input fallback.
- [ ] Test downloads/open/share on iOS, Android, desktop, and school-managed devices, with honest instructions for platform restrictions.
- [ ] Detect unsupported critical APIs with actionable guidance; no white screen or false saved state on unsupported devices.
- [ ] Record known platform limits in public help and a support contact path; do not claim completed testing for an unavailable device/browser.

Evidence: completed matrix, screenshots, physical-device recordings, OS/browser versions, and unresolved limitations.

## 11. Accessibility and field usability

Use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA as the product accessibility target, with automated and manual evidence. Evaluate each applicable criterion; the items below are a practical subset rather than a complete conformance claim.

- [ ] Complete all primary flows with keyboard only: predictable order, visible focus, skip link, no traps, and focus that is not hidden by sticky UI.
- [ ] Dialogs contain focus, have accessible names, support appropriate Escape behavior, and return focus to the trigger; destructive confirmations are understandable.
- [ ] Label all controls and validation messages programmatically; announce submission/save/sync/error changes without repeatedly interrupting screen-reader users.
- [ ] Test NVDA with Edge on Windows, VoiceOver with Safari on iOS/macOS, and TalkBack with Chrome on Android for the core scouting flow.
- [ ] Verify contrast, non-color status cues, labelled red/blue alliances, charts with data tables, and readable disabled/error/focus states.
- [ ] Verify text resize, 200% zoom, and reflow at 400% on desktop; horizontal scrolling stays within labelled data-table containers where necessary.
- [ ] Review touch targets, spacing, drag alternatives for picklist ordering, drawing alternatives, and accessible authentication/recovery without unnecessary cognitive tests.
- [ ] Respect reduced motion; use brief user-triggered animation without repeated entrances, flashing, or motion required to understand a state.
- [ ] Preserve the shared navy graphite/surface/text/red tokens, platform sans font, tabular numbers, restrained borders, and sentence-case action names.
- [ ] Desktop navigation uses a sidebar; phone navigation provides five destinations and More. Verify selected destination and browser back behavior.
- [ ] Run timed scouting trials with actual scouts, including gloved/one-handed use where relevant, noisy venues, glare, and low-brightness screens.
- [ ] Validate that a scout can correct a mistaken tap, distinguish zero from unanswered, see the assigned robot/alliance, and submit without ambiguous success feedback.

Evidence: accessibility findings/remediation, assistive-technology runs, and observed field trials.

## 12. Events, schedules, and season readiness

- [ ] Import/select official events using explicit event and season IDs; handle missing keys, unavailable APIs, empty schedules, and offseason/custom events.
- [ ] Keep practice, qualification, playoff, replay, and other supported match types distinct with stable identity. Unsupported formats get a clear limitation.
- [ ] Confirm robot/team/alliance/station mappings, surrogate/disqualification data where used, and schedule revisions/replays do not attach reports to the wrong match.
- [ ] Test time zones, daylight saving boundaries, local event time display, delayed matches, and device clock errors. Do not infer completion from scheduled time.
- [ ] Refresh active-event results without dropping existing reports, unknown fields, archived schedules, or downloaded offline context.
- [ ] Show source, last check, stale/error state, and unknown schedule status. An empty/failing upstream response must not erase a valid schedule.
- [ ] Coalesce/cache official requests across clients and teams within provider terms; avoid one upstream request per active scout polling tick.
- [ ] Event switching previews consequences, preserves prior evidence, and keeps queued reports assigned to their original event.
- [ ] A new season's forms/metrics are explicitly configured and reviewed. Do not infer phase mapping or season scoring from question names.
- [ ] Rehearse next-season rollover, archived event access, reused forms with new snapshots, and imports larger than automatic assignment limits.
- [ ] Provide a clear manual fallback when official data is unavailable; imported/manual provenance stays visible.

Evidence: fixture event cases, recorded upstream failure behavior, and a season rollover rehearsal.

## 13. Forms, reports, assignments, and teamwork

- [ ] Test every supported question type, required/optional validation, conditional visibility, defaults, numeric limits, missing/invalid values, and keyboard entry.
- [ ] Hidden conditional answers follow documented semantics and cannot silently corrupt analytics; changing an answer preserves recoverable edits where appropriate.
- [ ] Editing/archiving a template does not rewrite old question snapshots or strand unfinished drafts.
- [ ] Pit submission limits work concurrently across devices, refresh visibly, and retain a blocked draft; offline limits remain subject to server confirmation.
- [x] Reports preserve immutable identity/context when users rename themselves, switch teams/events, accept handoffs, or reconnect later.
- [ ] Assignment preview/apply/reconcile remains authorized, revision checked, bounded, and explainable. Oversized schedules/scout selections fail safely without removing imported data.
- [ ] Test absent/late scouts, substitutions, handoffs, rejected/expired handoffs, duplicate coverage, empty slots, and one user on several devices.
- [ ] A scout sees exactly which robot, station, match, event, and report type they are entering; overrides follow an explicit permission policy.
- [ ] Distinguish scheduled, assigned, draft, queued, confirmed, rejected, and missing coverage; pending uploads do not count as confirmed server evidence.
- [ ] Live revisions/polling avoid overlaps, pause sensibly while hidden, reconcile on return, and retain edits during updates.
- [ ] Saved picklists survive reload and event/team switching, require expected revisions, expose conflicts, and retain unsaved ordering edits.
- [ ] Test two admins editing assignments/picklists simultaneously and a scout submitting against changed assignments.

Evidence: multi-user fixture scenarios, report-context assertions, and revision-conflict demonstrations.

## 14. Analytics, comparisons, and interpretations

- [x] Profiles, comparisons, presentations, exports, and any analyst calculations use `src/argus/analytics.js` consistently.
- [x] Metric identity uses form/question IDs, explicit definitions, units, and `analytics_revision`; labels alone never merge unrelated questions.
- [x] Test true zero, unanswered, invalid, out-of-range, legacy, and changed-form answers separately; do not fill unknowns with fabricated zeros.
- [x] Linked duplicate reports contribute one match median as defined; expose disagreements, deduplication policy, and sample sizes.
- [x] Pit evidence stays separate from match performance, match sample counts, and match coverage denominators.
- [ ] Show coverage denominator, scheduled/unknown matches, freshness, source provenance, legacy exclusions, and filtering effects wherever a decision depends on them.
- [x] Validate calculations by hand on small known datasets, including ties, no evidence, one sample, outliers, duplicated matches, and conflicting reports.
- [ ] Compare identical teams/filters across profiles, charts, tables, comparison, presentation, PDF, and PowerPoint; values and missing-data explanations agree.
- [ ] Label official/third-party predictions distinctly from local scouting calculations; show provider, season, timestamp, and limitations.
- [ ] Never claim a ranking, win probability, or alliance recommendation is certain. Return insufficient information when the available evidence cannot support the calculation.
- [ ] Test access-controlled report links from every summary so a permitted reviewer can trace a value to source evidence without exposing another team.
- [ ] Confirm removed features and retired endpoints are absent from public promises; update help and notices to actual current behavior.

Evidence: calculation reference cases, cross-view comparisons, and source-report traceability.

## 15. External integrations and optional AI

- [ ] Inventory the integrations actually enabled in the candidate, including TBA, Match13, Statbotics, push delivery, and any optional Groq feature; record purpose, permissions, limits, and data sent.
- [ ] Keep keys private beside `DB_FILE`, outside releases/Git; browser status endpoints return connection flags only. Key rotation, removal, and invalid-key handling are tested.
- [ ] Team-owner configuration is server authorized; one team's keys, quotas, responses, and errors cannot leak into another workspace.
- [ ] Test provider outage, quota exhaustion, 429/backoff, malformed data, slow response, and revoked keys; existing schedules/reports remain usable.
- [ ] Validate provider terms, caching/redistribution permissions, attribution, and costs for public scale; credentials alone do not grant redistribution rights.
- [x] Verify that retired AI endpoints remain disabled if the release does not offer AI. Resolve documentation/configuration contradictions before launch.
- [x] If the authorized Groq integration ships, enable it only with private server configuration or workspace-owner Settings configuration and clearly label generated answers as interpretations.
- [x] If Groq ships, inspect actual outbound payloads: only bounded authorized numeric summaries and report references; no photos, drawings, notes, scout names, credentials, or cross-team records.
- [x] If Groq ships, treat uploaded/retrieved/user text as data, resist prompt injection, retain read-only behavior, expose sources/limitations, and fall back to deterministic local calculations on quota/service errors.
- [ ] Do not add another model provider or expand transmitted data without explicit user authorization; record approved data contracts and vendor privacy review.

Evidence: redacted outbound payload tests, provider-failure tests, owner isolation, and approved integration disclosures.

## 16. Media, exports, and presentations

- [ ] Bound file type, decoded dimensions, compressed size, per-report attachment count, and workspace storage; reject malformed or dangerous content safely.
- [ ] Review SVG/HTML and other active content; serve attachments with safe types/disposition, authorize access, and remove unnecessary location/identifying metadata.
- [ ] Test portrait/landscape photos, large camera images, unsupported formats, interrupted resizing/uploads, drawings, and attachment queue durability.
- [ ] Real PDF, PowerPoint, CSV/JSON or other advertised downloads produce nonempty valid files with the intended team/event/filter scope and safe filenames.
- [ ] Inspect every exported PDF page for clipping, blank/missing charts, text wrapping, page breaks, symbols/fonts, contrast, and report references on representative large and sparse datasets.
- [ ] Open PowerPoint exports in native PowerPoint and inspect every slide, charts, fonts, overflow, and controls. If unavailable, record the limitation and obtain a human rendering check before claiming compatibility.
- [ ] Test spreadsheet formula injection in CSV fields, escaping, Unicode, decimal formats, and consumer compatibility if CSV export is offered.
- [ ] Presentation open/close, keyboard navigation, Escape, focus return, fullscreen where supported, and phone viewing work without losing prior selection.
- [ ] Exports identify event/season, generation time, filters, units, samples, freshness, missing values, and exclusions so recipients can interpret them later.
- [ ] Export/recovery files exclude credentials, unrelated users, unauthorized notes, and other teams' evidence. Explain when a downloaded file contains private scouting data.
- [ ] Test long notes, non-English text, emoji, long team names, empty datasets, many reports, missing media, and revoked access during export.

Evidence: retained synthetic export samples, rendered PDF pages, native PowerPoint review, and cross-device download checks.

## 17. Public-scale performance and fair use

The following are proposed starting acceptance targets, not measured results or capacity claims. Ratify or tighten them before testing: core API p95 under 500 ms and p99 under 2 s at planned peak, excluding documented upstream-dependent work; a visible local-save acknowledgement within 1 s on the lowest supported device after successful storage; under 1% unexpected 5xx responses over a one-hour peak run; zero lost or cross-scoped reports. Record deliberate throttling separately and confirm legitimate users are not being routinely rejected. Set page-load and export budgets against named devices, networks, and dataset sizes.

- [ ] Model peak demand from concurrent teams/scouts, ten-second live polls, reconnect bursts, signup/login, media, exports, and official-provider refreshes; include a forecast beyond the first launch weekend.
- [ ] Generate representative synthetic multi-season datasets in isolated infrastructure with no real DB, private credentials, or production writes.
- [ ] Test planned peak, a sustained soak, a reconnect burst, and at least a documented headroom case such as twice planned peak; record exact workload and hardware.
- [ ] Measure latency percentiles, error rates, throughput, event-loop lag, memory/GC, CPU, DB bytes/write time, disk utilization, open connections, upstream calls, and queue drain time.
- [ ] Prove one abusive or very large team cannot consume all auth, assignment, export, upload, polling, disk, or integration capacity; apply fair per-team budgets.
- [ ] Test official-data outages and slow upstreams during peak load; local saves and confirmed report writes stay available within the approved budget.
- [ ] Review list payload size, pagination, filtering, rendering cost, media resizing/lazy loading, request coalescing, and caching at the largest supported workspace size.
- [ ] Test low-end phone memory/CPU, slow networks, packet loss, high latency, and a queue accumulated over an event day.
- [ ] Set storage/cost quotas with warnings and recovery options; reaching a quota must not silently delete existing reports or falsely confirm a save.
- [ ] Establish limits and an upgrade plan for the single-writer JSON architecture. Move to a reviewed transactional design before enabling incompatible horizontal scaling.
- [ ] Record maximum tested capacity and admission controls publicly where relevant; block expansion beyond evidence rather than promising all-team concurrency without proof.

Evidence: reproducible workload scripts, performance report, capacity model, cost estimate, and admission/scale decisions.

## 18. Hosting, deployment, and release safety

- [ ] Separate development, fixture QA, staging, and production databases, credentials, domains, storage, and alerts.
- [ ] Verify the public service uses the production build, active entry point, production runtime configuration, and private persistent paths outside release directories.
- [ ] Deploy under a least-privileged service identity; restrict SSH/admin/update access, rotate secrets, and protect the deployment branch and credentials.
- [ ] Make build/release artifacts reproducible from the lockfile and recorded revision; inventory included files and exclude DBs, private configuration, logs, fixtures, and unlicensed promotional assets.
- [x] Verify release/package version, lockfile root version, health/version response, and generated release metadata agree; use a new version for every delivered update.
- [ ] Rehearse staged deployment, health checks, failed start, asset propagation, persistent file permissions, and restart without DB reinitialization.
- [ ] Test rollback of application code while preserving newer scouting records. Rollback must not restore an older database over new reports.
- [ ] Check old/new API and offline schema compatibility during rollout; migrations have an explicit safe-forward/recovery plan.
- [ ] Ensure only one writer runs during a release switch; old and new processes cannot concurrently mutate the JSON database.
- [ ] Confirm production monitoring, alerts, backups, private integrations, session persistence, and upstream credentials survive release swaps.
- [ ] Require explicit authorization before pushing/deploying the deployment branch. Checklist completion does not authorize a production push.

Evidence: staging release/rollback rehearsal, version verification, archive inspection, and deployment runbook.

## 19. Backups and disaster recovery

Proposed initial recovery targets for owner approval: off-host recovery point at most 15 minutes of confirmed server records, and service recovery within 2 hours. These are targets to design and test, not promises already supported by the current file-store design. Unsynced device reports require their separate recovery path.

- [ ] Approve actual RPO/RTO, event-day recovery priorities, backup frequency, retention, encryption, off-host location, and responsible responder.
- [ ] Back up database, referenced media, necessary private configuration, and recovery instructions consistently; separate and protect encryption keys and credentials.
- [ ] Ensure snapshots are consistent with active writes; test backups taken during reports, media uploads, and event changes.
- [ ] Verify backup success, completeness, age, integrity, storage capacity, and alert delivery automatically; failed backups trigger a human response.
- [ ] Restore to an isolated environment and reconcile record IDs/counts, media references, permissions, archived events, and recent acknowledged reports.
- [ ] Reapply deletions/retention obligations after restoration; decide whether sessions and credentials need revocation/rotation.
- [ ] Rehearse server loss, corrupted DB, full disk, leaked credential, domain/proxy outage, accidental release, and maintainer unavailability.
- [ ] Provide an event-day offline continuation procedure and explain that server backups cannot recover never-uploaded local reports.
- [ ] Demonstrate recovery without writing fixtures to production or overwriting newer scouting evidence; document safe reconciliation when recovered and new records coexist.

Evidence: timed restore drill, reconciliation report, backup alerts, and approved recovery targets.

## 20. Monitoring, incidents, and support

- [ ] Monitor public availability, auth failures, upload confirmation failures/conflicts, response latency, DB write failures, disk/memory, backup age, and upstream outages.
- [ ] Alert on unusual cross-team authorization failures, signup/join abuse, privilege changes, repeated restore failures, and unexpected outbound integration behavior.
- [ ] Redact secrets, cookies, recovery codes, personal notes, photos, and unnecessary scout identifiers from logs; set access and retention controls.
- [x] Use request/error correlation IDs that help support without exposing raw report content or private paths to browsers.
- [ ] Verify alerts reach the primary and backup responders; test an alert during the competition coverage window.
- [ ] Publish a status/support channel independent of the primary application, with truthful uptime and response expectations.
- [x] Write incident steps for containment, preserving evidence, disabling a vulnerable feature/signup, revoking sessions/keys, recovering service, and communicating impact.
- [ ] Include privacy breach assessment and jurisdiction-appropriate notification decisions with qualified guidance; avoid inventing universal legal deadlines.
- [ ] Provide issue reporting with version, device/browser, time, workspace reference, and safe diagnostics; never ask users to send passwords or recovery codes.
- [ ] Define event-weekend support coverage, escalation, release freezes during critical competition periods, and post-incident review ownership.
- [ ] Verify support can help a locked-out owner, unsynced scout, mistaken team claim, disputed report, and deletion requester without bypassing identity checks.

Evidence: delivered test alerts, incident tabletop, support exercises, and monitored public contact.

## 21. Licensing, dependencies, and public identity

- [ ] Confirm Argus code ownership, contributor permissions, and intended distribution license; third-party notices do not themselves license Argus.
- [ ] Resolve the dependency notice inventory gaps recorded in `dependency-notice-gaps.txt` by reviewing actual shipped components and upstream obligations.
- [ ] Generate version-matched dependency/license notices for the candidate, including bundled build-time code where applicable; expose required text in the release.
- [ ] Recheck direct and transitive dependency advisories, maintained upstreams, install scripts, lockfile integrity, package provenance where available, and runtime support.
- [ ] Triage findings by reachability/exploitability and remediate release-blocking risks; a clean advisory scan is not proof of no vulnerabilities.
- [ ] Review API/data licenses, attribution, caching and redistribution rights, robot/team media permissions, fonts/icons, and any externally sourced assets.
- [ ] Exclude promotional videos with unlicensed commercial songs and unapproved footage from public distribution and release archives; review historical exposure separately without silently rewriting history.
- [ ] Use the approved Argus identity and accurate team/operator credit. Verify trademark/brand permissions and independent-tool wording; do not imply FIRST endorsement.
- [ ] Verify notices/terms/privacy links work while signed out and signed in, on phones, and in exported/released packages as applicable.

Evidence: license decision, resolved notice inventory, candidate dependency report, and asset permission register.

## 22. Documentation and user onboarding

- [ ] Publish a short first-event guide: account/team setup, event selection, form setup, scout invitations, assignments, offline preparation, submission, sync confirmation, and evidence review.
- [ ] Provide separate role guides for scouts, analysts, admins, owners, and service operators as applicable.
- [x] Explain save versus sync, recovery codes, local storage loss, account switching, pending-report recovery, and what to do before clearing site data.
- [x] Explain assignment handoffs/late scouts, stale schedules, missing data, pit limits, report conflicts, and legacy report exclusions in plain language.
- [x] Describe how team data is shared internally, what public availability means, how to rotate invitations, and how to remove members safely.
- [x] Provide installation/download instructions and honest platform limits, including iOS foreground reconnection and native PowerPoint rendering status.
- [ ] Include privacy/security/support contacts, deletion procedures, acceptable use, capacity/retention limits, and service status.
- [x] Explain analytical denominators, samples, disagreement, provenance, and third-party predictions; avoid promotional certainty about alliance decisions.
- [ ] Test instructions with people from teams other than 6390 without maintainer coaching; record confusion and correct the workflow or documentation.
- [ ] Review international usability: Unicode team names, local time zones, metric units, date/number formatting, and language scope. Provide a translation policy if multiple languages are promised.
- [ ] Publish release notes, support matrix, known issues, and changelog tied to actual shipped versions.

Evidence: public documentation review and independent onboarding feedback.

## 23. Release-candidate verification

- [ ] Start from a recorded clean candidate revision and review the diff; confirm no unrelated changes, real datasets, secrets, or generated private artifacts are included.
- [x] Increment `Clasue-scout-app/package.json` and matching lockfile version for the delivered change; select patch/minor/major according to project policy.
- [x] Run `npm test` in `Clasue-scout-app`; retain test names, counts, exit status, runtime, and environment.
- [x] Run `npm run build` in `Clasue-scout-app`; inspect release metadata and warnings and confirm the active local app is built.
- [x] Run focused ESLint on changed active modules, using `npm run lint:active` where appropriate; record any excluded/pre-existing findings.
- [x] Run `npm run test:browser` using its disposable fixture DB/server and Edge default. Repeat in production mode where needed to exercise production behavior.
- [x] Verify offline reload/reconnection, roles, assignment context/handoffs, picklist persistence, presentation keyboard controls, and real downloads on the candidate.
- [ ] Inspect screenshots at all six required widths and complete the real-device matrix; no viewport emulation substitutes for engine/platform verification.
- [x] Render and inspect PDF exports; obtain native PowerPoint review or explicitly restrict the compatibility claim until that review exists.
- [ ] Complete security/permission tests, migration tests, load tests, backup restore, monitoring alerts, and staging rollback independently of the basic regression suite.
- [x] Record failures, fixes, reruns, and remaining limitations in `docs/argus-2`; maintain evidence links rather than copying previous release pass claims.
- [x] Confirm mutable browser/load/fault tests never target production or the real database. Production checks are approved read-only/operational checks unless separately authorized.

Evidence: candidate verification report with commands, exit codes, artifact paths, device results, and reviewer sign-off.

## 24. Pilot rollout and release day

- [ ] Complete internal rehearsal on multiple physical devices, then a small invited pilot with unrelated teams, then a broader opt-in beta before unrestricted signup.
- [ ] Set measurable pilot exit criteria: no unresolved data loss/isolation issue, successful offline recovery, usable onboarding, approved performance budgets, and completed core device coverage.
- [ ] Run at least one event-day-length trial covering simultaneous scouting, weak Wi-Fi, long queues, reschedules, late scouts, picklist changes, presentations, and exports.
- [ ] Gather feedback from different team sizes, experience levels, device budgets, accessibility needs, and geographic/network conditions.
- [ ] Use admission limits and server-side feature controls for integrations, signup, or expensive optional features; test their safe operation without deleting reports.
- [ ] Triage pilot issues, fix blockers, rerun affected tests, and freeze a new candidate; do not carry stale sign-offs across material changes.
- [ ] Before launch, verify responder availability, status page, alert delivery, fresh validated backup, storage headroom, certificates, provider quotas, and public notices.
- [ ] Obtain final owner/operator approval for the exact candidate and separate explicit production deployment authorization.
- [ ] Deploy using the rehearsed procedure, verify health/version and core reads, watch confirmed-write/error metrics, and stop expansion if thresholds fail.
- [ ] Pause signup or disable the affected optional feature on a serious incident; preserve existing teams' access and reports where safe. Use the rehearsed recovery procedure.
- [ ] Publish accurate availability, support scope, known limits, and incident contact only after launch checks pass.
- [ ] Review after the first 24 hours, first event weekend, and first month; reassess capacity, costs, support burden, youth/privacy handling, and the device matrix before expanding further.

Evidence: pilot results, final go/no-go record, authorized deployment record, and post-launch review dates.

## 25. Sign-off register and hard stop rules

Create one row for every gate 1–24, using the actual accountable people rather than invented owners. Maintain separate issue records when a section contains work owned by several people.

| Gate | Named owner | Reviewer | Target date | Status | Candidate version/revision | Evidence / remaining issues |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Scope and responsibility | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 2. Signup and ownership | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 3. Account security | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 4. Team isolation | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 5. Privacy and youth | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 6. Security | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 7. Storage and migrations | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 8. Offline and reconnection | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 9. PWA and updates | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 10. Device matrix | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 11. Accessibility | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 12. Events and seasons | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 13. Scouting and teamwork | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 14. Analytics | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 15. Integrations | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 16. Media and exports | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 17. Capacity | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 18. Deployment | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 19. Disaster recovery | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 20. Monitoring and support | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 21. Licensing | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 22. Documentation | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 23. Candidate verification | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |
| 24. Pilot and rollout | Unassigned | Unassigned | Unscheduled | Not verified | Not selected | Required |

Final approval record:

- [ ] Every gate has an owner and evidence; every conditional exclusion is justified and enforced in the shipped product and public claims.
- [ ] No unresolved data loss, cross-team access, account takeover, secret disclosure, or critical scouting failure on a supported platform.
- [ ] Youth/privacy/operator/contact decisions are implemented and reviewed for the stated audience; draft notices are replaced with accurate published notices.
- [ ] Backup restore and rollback have succeeded; new scouting records are protected through failures and recovery.
- [ ] Planned public capacity, legitimate shared-IP usage, fair-use protection, and provider budgets are supported by measured evidence.
- [ ] Device/browser/PWA and accessibility claims match completed tests; native PowerPoint compatibility has actual rendering evidence if claimed.
- [ ] Security and dependency findings have reviewed dispositions; no unresolved critical/high exposure is carried into unrestricted launch.
- [ ] Remaining lower-risk issues have an accountable owner, concrete mitigation, deadline, and public limitation where users need it. They cannot waive the hard stops above.
- [ ] Operator/release owner records **go** or **no go**, candidate version/revision, scope, date/time, reviewers, and rollout limits.
- [ ] Explicit deployment authorization is recorded separately; no push is implied by approving this checklist.

Stop launch or pause expansion whenever any hard stop is discovered, evidence becomes invalid after a material change, required responders are unavailable, or actual load exceeds the validated capacity. Preserve evidence and scouting records, contain the failure, and require a fresh reviewed decision before resuming.

## Suggested order of work

1. Resolve scope/operator/youth/privacy/licensing decisions and establish release ownership (1, 5, 21).
2. Prove team isolation, account security, storage durability, offline recovery, and production recovery (2–8, 18–20).
3. Finish the real-device/PWA/accessibility matrix and core FRC workflow evidence (9–16).
4. Validate capacity and costs, complete public documentation, and assemble the candidate evidence (17, 22–23).
5. Run invited pilots, resolve blockers, complete the sign-off register, and request the separately authorized deployment (24–25).

This sequence prioritizes dependencies; device pilots, documentation review, and legal/operational work can proceed concurrently when they do not depend on unresolved decisions. This checklist does not authorize implementation, external publication, messages to teams, or production deployment by itself.
