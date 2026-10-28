# Argus implementation progress

Started 2026-10-20 from `618b962` in a clean checkout. User authorized implementation,
then explicitly authorized commit/push after verification. Main triggers deployment.
No production database is available here; all tests must use temporary fixtures.

## Overall status

5.0.0 implemented and verified for this increment. Critical ownership/security
foundations and the supporting workflows below are implemented and fixture-tested.
Committed locally; publication is blocked by GitHub write permissions. The entire approved roadmap is **not**
declared finished: extended acceptance and enhancement work is listed below.

## Phase checklist

- [x] Read approved conversation plan, AGENTS.md, audit current code/test setup.
- [x] Check clean worktree and current remote (baseline unchanged).
- [x] Persist approved blueprint and feature inventory.
- [x] Security/data foundations and first API/domain regression tests (6 passing targeted tests).
- [x] Persistent ownership, duties/conflicts, Admin accountability (domain/API/browser tests).
- [x] Mobile assignments and scouter experience (six viewport fixture checks).
- [x] Isolated practice, basic progress, analyst/strategy and server data-quality integration.
- [x] Role onboarding/help/instructions and in-app/opt-in push reminder infrastructure.
- [x] Final unit/API/offline/browser/build/lint verification for this increment.
- [x] Commit verified stable changes locally (`af7f46a`, release implementation).
- [ ] Commit and push verified stable changes; record revision and limitations.

## Baseline verification

Planning audit: 79 tests and build passed. Full lint failed (54 errors/15 warnings).
Browser suite could not launch because Edge was unavailable. Dependencies are
installed in the isolated checkout. No unrelated user changes were present.

## Decisions and invariants

- Reuse current stack, forms, autosave, queue, handoffs, analytics and identity.
- JSON migration is additive and backed up before first persisted upgrade.
- No destructive event transition; retain historical context and delayed reports.
- Canonical ownership separate from match responsibility; no automatic handoff.
- Scouter raw-report privacy retained; shared summaries require approval.
- Preserve IndexedDB identity, real draft keys and submission retry payloads.
- /superpowers is not installed; repository React/Playwright guidance is used.

## Changed files

Preparation: docs/ARGUS_UPGRADE_PLAN.md, docs/ARGUS_FEATURE_AUDIT.md,
docs/ARGUS_IMPLEMENTATION_PROGRESS.md. Later phase entries will enumerate modules.

### Foundation checkpoint

Implemented additive backed-up schema migration, private hashed persistent sessions,
domain capability/audit helpers, controlled member removal/roles and two-party
reauthenticated ownership transfer. Event activation now retains outgoing records;
old destructive calls are rejected. Reports have reversible state metadata and
server-side required/type/context checks; old unknown snapshots are flagged for
review. Generic readonly ownership and publication writes cannot bypass services.

New services: database.cjs, domain.cjs, private-sessions.cjs, member-service.cjs,
submission-service.cjs, assignment-service.cjs, shared-analytics.cjs,
upgrade-routes.cjs, notification-service.cjs. Existing server/event/handoff code
is integrated incrementally. New UI: assignment-hub, admin-centre, practice,
help/walkthrough/evidence/reminders; mobile overrides in upgrade.css. Linked
instructions exist. These UI/reminder changes remain under verification.

Verified so far: node --test server.test.cjs upgrade.test.cjs: 6/6 pass; build
passed after initial UI integration. Full suite and browser checks must run again
after final integration. Edge install needs root, so Chromium was installed as
the documented fallback. No production calls, commit or push yet.

Decisions: retire the old per-match generator endpoint with an explicit 409 rather
than silently reinterpreting old-client requests. Keep legacy ownership on create
for compatibility and import existing unambiguous allocations on migration. New
practice uses the existing form renderer and atomic offline queue with a separate
destination/key namespace. API session tokens are hashed at rest. Push credentials
are generated in a private persistent file; delivery tests use a fake transport.

### Assignments and administration checkpoint

`assignment-service.cjs` implements seeded fair team allocation, explicitly selected
scouts, fill/preserve and unlocked rerandomization, locked/manual owners, stale
preview checks, idempotent application, schedule reconciliation, collision and
unowned-team detection. Team ownership remains separate from effective duties.
Accepted handoffs keep primary ownership and append responsibility history;
pending/expired handoffs do not transfer it. Completed work and explicit manual
exceptions are preserved. New plans generate future duties rather than inventing
retroactive accountability for matches already completed before the plan existed.

`admin-centre.jsx` combines missing reports/current responsible scouts, member
management, assignments, report recovery/review, shared measurement approval,
handoffs, practice progress and paginated activity. Direct API checks enforce the
Owner/Admin/Scouter hierarchy. Ownership transfer needs password reauthentication
and recipient acceptance within 15 minutes. Removed member evidence is retained.

### Scouter/mobile checkpoint

`assignment-hub.jsx` shows permanent teams, pit completion, next match duties,
coverage, conflicts and pending-versus-confirmed uploads. Existing handoff UI is
reused. Mobile retains five bottom destinations with direct Assignments access.
The active event is authoritative; the header no longer switches it. Event
activation is non-destructive. `history.jsx` browses historical permitted analytics
without changing the active event. Role changes invalidate downloaded reads while
preserving drafts/queues. Older destructive/generator clients receive explicit
conflicts instead of silently losing data.

### Practice, intelligence, help and reminders checkpoint

`practice.jsx` reuses the real form renderer with separate draft keys, queue
destination and `practice_submissions` storage. Basic confirmed pit/match progress
is visible to Admins. Practice never enters competition analytics or rankings.
Server validation checks required fields, types, options, bounds and identity;
unknown historical form snapshots are retained for reasoned Admin review rather
than silently counted. Report removal is reversible and retry IDs stay reserved.

The dedicated analyst retains deterministic local calculations and optional Groq
infrastructure. Partner shortlists require configured metric direction and show
samples; private notes/photos/names are not transmitted. Strategy adds metric and
coverage filters/sorting and sample evidence while preserving revisioned picklists,
drafts, comparison and exports. Observations can separate pit and match evidence.
Scouters receive approved structured summaries and projected source evidence only.

`walkthrough.jsx`, `help.jsx`, `ownership-inbox.jsx`, `reminders.jsx` and 17 linked
Markdown topics add role-relevant skippable/replayable onboarding and offline help.
The committed `help-content.json` snapshot makes older app-only deployment archives
work; a test prevents drift or broken links. Existing inline form photo capture
and notes remain available; dedicated media management is not implemented.

Reminder preferences, availability, timezone, in-app inbox, deduplicated jobs,
routine quiet hours, bounded retries and optional browser push are implemented.
`web-push` 3.6.7 is the only added dependency. Private VAPID/session files persist
outside releases and are ignored by Git. Push destinations are allowlisted HTTPS
browser providers to avoid arbitrary server-side requests. Tests use fake delivery;
live phone/provider behavior is not claimed verified.

### Final verification record

- `npm test`: **91/91 passed**, including deployment status, migration safety,
  permissions, ownership/locks/deselection, stale/replayed writes, handoff states,
  report recovery/review, approved conditional evidence, event history, private
  sessions across restart, practice isolation and offline queue regressions.
- Offline practice reload test confirms only `/api/practice` receives the report;
  cross-destination same-ID edits are refused. Real queue tests retain photos,
  zeros, lost acknowledgements, errors, receipts and account boundaries.
- `npm run lint:active`: passed, no errors/warnings in the live app/services.
  CI now gates this command. The unused Firebase/legacy entry still has pre-existing
  full-repository lint debt; it was not rewritten merely to silence lint.
- `npm run build`: passed for 5.0.0, including PWA generation.
- `npm audit --omit=dev`: zero vulnerabilities reported at verification time.
- `bash -n deploy.sh` and `git diff --check`: passed.
- Final browser suite: **13/13 passed**, zero browser page errors, on the fresh
  5.0.0 build. Covers real offline reload/upload, practice resume/isolation, roles,
  ownership/locks/handoffs, report recovery/publication, help/reminder preferences,
  picklist persistence/exports, non-destructive activation and historical browsing.
  Chromium is used because Edge could not be installed without host privileges.
  Screenshots at 1440/1280/1024/768/390/360px have no document overflow. Phone
  assignment/Admin/strategy screenshots were inspected. Fixture artifacts are at
  `/tmp/argus-browser-qa-23VEOD` (database `/tmp/argus-qa-x7nIYC/db.json`).
  These local artifacts are not shipped or a guarantee of real-phone behavior.
- Performance diagnostic: 60 teams / 120 matches / 30 scouts preview took about
  381 ms with zero schedule collisions in that fixture after precomputing the
  collision graph (initial naive scoring took ~34 s). This is not a sustained
  multi-client performance guarantee.
- Real PDF/PowerPoint files downloaded in browser QA. The exported PDF cover was
  rendered and inspected; native PowerPoint rendering was unavailable.

### Changed-file map

- Foundations/API: `database.cjs`, `domain.cjs`, `private-sessions.cjs`,
  `member-service.cjs`, `submission-service.cjs`, `assignment-service.cjs`,
  `shared-analytics.cjs`, `upgrade-routes.cjs`, `notification-service.cjs`,
  `server.cjs`, `event-transition.cjs`, `match-handoffs.cjs`, `analyst-service.cjs`.
- UI: new modules listed above plus `evidence.jsx`, `upgrade.css`; integrations
  in workspace/operations/restored-features/strategy/analytics views and models,
  `frc-scout-local.jsx`, form conditions and offline client.
- Safety/verification: upgrade/notification/help/model tests, adapted existing
  tests, browser checks, ESLint config, CI, deployment test gate, push service
  worker import, locked package version/dependency, private-file ignore rules.
- Documentation: README, approved blueprint/audit/progress, release notes,
  historical transition warning, root instructions and bundled offline snapshot.

## Remaining work and next action

### Security hardening increment — 2026-10-28

- Local branch: `security/hardening-5.12`; candidate version 5.12.0. This increment has not been pushed or deployed.
- Completed: provider-HTML sink removal, decoded raster validation, optional TOTP MFA with encrypted private storage and recovery codes, privileged MFA step-up, private-file symlink rejection, security scan/CI gate, and the complete `docs/security/` operator set.
- Verification: 184/184 automated tests; 25/25 browser workflows; 47 accessibility states with zero automated violations; active lint, production build, security scan, deployment-shell syntax and diff checks passed. Production dependency audit is clean; four Low build-only advisories remain documented. Full-tree lint still has pre-existing inactive/legacy violations.
- Bounded synthetic workloads at 1/5/10/20/30 clients completed with zero errors, cross-team leaks or integrity failures. These short localhost runs do not establish production capacity.
- Blockers before deployment: authorized Cloudflare/origin verification, actual-host resource rehearsal, encrypted off-site backup/restore drill, MFA key custody and staged privileged-user enrollment. See `docs/security/PRODUCTION_SECURITY_CHECKLIST.md`.

The earlier release/push notes below are historical and do not authorize pushing this security branch.

No production database was accessed. Release implementation is committed at
`af7f46ac92bdd76602271d985c66d0830e2fa7c4`. Both terminal `git push origin HEAD:main`
and the connected GitHub integration's tree creation were rejected with HTTP 403
(permission denied / resource not accessible by integration). Neither changed the
remote. Main remained `618b962` at the last check. No deployment occurred.

The next action is to restore repository Contents/write access to the Git credential
or integration, then run `git push origin main` from this checkout after reviewing
the latest remote. Do not force-push over concurrent work. A portable delta bundle
will be saved at `/workspace/ARGUS-5.0.bundle`, containing both the implementation
commit and this status update. The bundle needs the baseline repository history.
A push may trigger the existing updater; actual host health and production migration
remain outside this fixture environment.

- [ ] Validate opt-in push on actual Android/iOS devices, denied permission,
  installation/background behavior and provider failure/revocation in production.
- [ ] Rehearse a sustained multi-client competition load, low-memory host recovery,
  disk exhaustion, backup restoration into an isolated copy, and real TBA refresh.
- [ ] Expand manual screen-reader/zoom/high-contrast and physical touch testing;
  browser widths/keyboard/focus/overflow are not a full accessibility audit.
- [ ] Add richer training assessments if needed; current progress records confirmed
  practice pit/match submissions, not certified scout skill.
- [ ] Dedicated organized media/gallery/storage limits and controlled photo/notes
  publication remain enhancements; current form media stays private and intact.
- [ ] Further alliance confidence/robot-capability refinements need real event
  forms and calibrated team-defined metrics, not invented season scoring.
- [ ] Native PowerPoint rendering and broader browser/OS coverage remain unverified.
- [ ] Existing inactive-entry lint debt and a general JSON-store retention/scale
  policy remain follow-up maintenance, not silently treated as completed roadmap work.
