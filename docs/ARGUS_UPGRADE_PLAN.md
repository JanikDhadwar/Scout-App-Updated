# Argus approved upgrade blueprint

Approved in conversation on 2026-10-20. Baseline: `618b962`, Argus 4.2.0.
This is the durable implementation specification transcribed from the approved
conversation plan. Implementation/verification state belongs in
[implementation progress](ARGUS_IMPLEMENTATION_PROGRESS.md), not in this plan.

## Goals and decisions

Preserve React/Vite, Express, the single-writer JSON database, existing forms,
autosave, IndexedDB `scout-device-v1`, real draft keys, immutable submission IDs,
retry receipts, current handoffs, shared analytics, Groq, picklists and exports.
No replacement authentication provider, frontend framework or database rewrite.
Scouters see approved shared summaries, not other scouts' private raw reports.
Temporary coverage requires acceptance for one team in one match. Reminders
include in-app and opt-in Web Push. Keep the navy/graphite/red Argus identity.

## Priority and implementation sequence

1. P0 foundation: additive versioned migrations, backups, atomic audit entries,
   centralized capabilities, Admin ordinary-member management, secure two-party
   ownership transfer, non-destructive event activation, reversible report removal,
   role/session refresh and API-side validation.
2. P0 assignments: canonical permanent team owners; selected participants; locks;
   fair seeded preview/apply; manual changes; derive pit and match duties; schedule
   reconciliation; conflict detection; effective-responsibility history; reuse
   handoffs; actionable Admin overview.
3. P1 workflows: team-first mobile assignments, next actions, request-cover links,
   five mobile destinations (Home, Assignments, Scout, Teams, More), explicit current
   event everywhere, isolated practice using existing form renderer/queue.
4. P2 intelligence: approved aggregate/evidence APIs, dedicated analyst, bounded
   pit evidence, deterministic partner criteria, picklist usability/confidence.
5. P2 learning/reminders: linked Markdown instructions and offline in-app help,
   role-specific skippable/replayable guide, durable notification jobs, private
   VAPID subscriptions, validated push endpoints and service-worker handlers.
6. P3 refinements: curated notes/photos with publication controls and external
   media storage; training progress; lightweight data quality/review tooling.
7. Release gates: permission/integration/offline tests, build, focused lint,
   fixture browser checks, responsive screenshots, load and recovery rehearsal.

## Ownership and responsibilities

Canonical `team_allocations`: workspace/event/team/owner, lock, revision and
timestamps. `assignment_plans`: participating users, pit/match forms, revision,
seed. Duties retain existing IDs and `scout_user_id` as effective responsibility;
add allocation and primary-owner references. Handoffs never modify allocations.

Generation fills unowned teams by default. Explicit rerandomization moves only
unlocked allocations. Selected active members receive new teams; deselected
locked owners remain with warnings. Unconstrained counts differ by at most one.
Use reproducible seeded candidates, weighted shared-match conflicts, bounded
improving swaps, then workload tie-breaks. Preview reports unresolved collisions;
apply validates expected plan/event revisions and idempotency. No promise of
global optimum. Missing schedule means unknown coverage, not no work.

One pit duty per team and one duty per official robot appearance. Preserve
completed duties, accepted coverage, and explicit legacy exceptions. Reconcile
new schedule entries idempotently. Flag cancelled/changed slots without deleting
reports. Full match key (including playoff sets) is the identity.

Import only unambiguous legacy `event.assignment` ownership. Do not infer a
permanent owner from an arbitrary modern match duty. Preserve ambiguous data for
Admin review. Keep immutable responsibility history for duty changes.

Handoff lifecycle: pending -> accepted -> completed, or declined/cancelled/expired.
Preserve five-minute-or-match-start expiry and connected-peer checks. Accept is
transactional and checks recipient capacity. Push is never acceptance. Admin
coverage overrides require a reason. Completion requires a matching confirmed
real report; visits and queued reports are not completed duties.

## Permissions and data safety

Stored role `member` is displayed as Scouter. Owners inherit Admin/Scouter;
Admins manage duties/forms/reports and remove ordinary members, but never grant
Admin/Owner or edit privileged membership. Only Owners manage Admin roles and
private keys. Transfers require Owner reauthentication and recipient acceptance
within 15 minutes; exactly one Owner; previous Owner becomes Admin.

Keep original reports immutable. Removal/restoration uses server-controlled
metadata, retains retry IDs and recalculates completion/analytics. Audit role,
form, removal, randomization, ownership, coverage, handoff and event actions in
the same write as each mutation. Do not log secrets or answers.

Switching active event preserves all event records. Historical browsing is
separate from activation. Never auto-display the next TBA event over the selected
one. Retain history to authorize delayed offline reports. A former responsible
scout's delayed evidence must not silently complete a new recipient's duty.
Retain unknown fields and archived forms. No destructive restore over newer data.

New collections are service-controlled, not arbitrary generic writes. JSON
mutations remain synchronous/single-writer. Back up before first migration.
Private sessions/push credentials live outside releases and generic APIs.

## User-facing feature acceptance

- A assignments: persistent teams, deselection, fairness, locks, preview/manual
  changes, every match duty, conflict warnings, handoff-safe reconciliation.
- B permissions: backend role matrix, foreign IDs rejected, transfer safety,
  cross-tab/device role refresh without deleting drafts/queues.
- C Admin: Needs attention/Members/Assignments/Forms and reports/Activity;
  responsible people named for missing pit/match reports, including handoffs.
- D coverage: one-match requests/acceptance; original owner unchanged; explicit
  pending/accepted/expired/cancelled/completed status.
- E practice: separate sessions/submissions and draft/queue destination; sample
  context clearly labelled; never enters real statistics/AI/strategy/reminders.
- F analyst: dedicated route, suggested questions, authorized evidence/sample
  sizes, local fallback, deterministic comparable-metric shortlist; no invented
  scoring, predictions or external transmission of notes/photos/scout names.
- G events: active ID authoritative; management in Settings/Admin; history and
  late uploads preserved; clear no-event state; no topbar switch control.
- H assignments UI: My teams/Next matches/Needs attention; responsibility versus
  ownership labels; correct form opens within two taps; upload states distinct.
- I strategy: preserve picklist IDs/drafts/revisions; filter/sort real metrics,
  confidence and sources; touch/keyboard reorder; missing never becomes zero.
- J mobile: 360 through 1440px, 44px targets, keyboard/zoom/reduced motion, no
  document overflow; bottom nav does not cover form actions.
- K walkthrough: role-relevant, skippable/reopenable, never interrupts a draft.
- L help: offline topics/search/context links from shared Markdown content.
- M docs: instructions/contents.md with relative links, topic guides, internals,
  setup/restart/troubleshooting; correct stale documentation.
- N reminders: opt-in push, deduped inbox, ~5min upcoming match, daily pit digest,
  handoff/conflict changes; expiry/quiet hours/preferences, no stale delivery.
- O activity: atomic actor/time/action history and reversible removals.
- P notes/photos: organize existing sources, publication, authenticated media,
  size/type checks, legacy inline support, no private runtime-cache leakage.
- Q quality: shared conditional required/type/bounds/context validation;
  server-recorded form versions; preserve/review unknown legacy snapshots;
  corrections do not silently overwrite observations.
- R reliability: retain IndexedDB/store/draft identities; atomic enqueue/receipt,
  same-ID retries, quota failures, cache invalidation never clears queue/drafts.

## Test/release gates

Test all roles and cross-workspace requests; selected-scout exclusion; persistent
teams; collisions; accepted/expired handoffs; revision races; migration retries;
history preservation; removed/restored report retries; practice separation;
approved summary redaction; push endpoint validation and scheduling; autosave,
offline photos/reload/reconnect/lost acknowledgements; existing exports/AI/lists.
Use temporary fixture databases only. Run npm test/build, focused lint and
Playwright. Inspect 360/390/768/1024/1280/1440px screenshots and supported phones.
Performance fixture: 60 teams/30 users/120 matches/2000 reports/30 clients;
target P95 ordinary API <500ms and assignment preview <2s. Rehearse backup and
rollback; code rollback must not restore an older live database.

Expected total roadmap effort was 8–12 engineer-weeks. Partial sessions must
leave stable code and explicit outstanding checklists. Never equate UI existence
with verified completion. Push/deployment requires user authorization (granted
in the execution conversation after verification; no destructive operations).
