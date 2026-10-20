# Feature comparison: “Named it Argus”

Reference: [e1a3276a36ac104c63ef92923eac0400ada35ed0](https://github.com/JanikDhadwar/Scout-App-Updated/commit/e1a3276a36ac104c63ef92923eac0400ada35ed0), September 14, 2026. The configured GitHub main branch was fetched before comparison. Historical sources were inspected with `git show`; no checkout, database replacement, reset, push or deployment was used.

The deployed entry at that revision was `Clasue-scout-app/src/frc-scout-local.jsx`, with `workspace-ui.jsx`, `report-media.jsx`, form conditions and the offline modules. The unused Firebase entry was not treated as a missing active feature. The rename itself changed branding; the reference snapshot also contains the earlier event, assignment and report workflows.

## Feature mapping

| Older workflow | Current equivalent |
| --- | --- |
| Sign in, create account, create/join/switch team, logout | Active account/workspace screens, with server authentication and scoped sessions |
| Home shortcuts, forms, news, event and offline status | Home quick actions, five main destinations, Settings news and device/sync |
| Leave a team | Settings → Account controls → Leave workspace, for non-owners; original reports and local drafts/queues retained |
| Delete account/team | Deactivate account / archive workspace, retaining evidence and protecting ownership |
| Post/remove announcements | Settings → Team news, existing authorized announcement controls retained |
| Create/edit/remove forms; reorder/require questions; choose team and submission limit | Match/Pit forms and builder; removal archives templates and preserves unfinished drafts; limits server-enforced per event/team |
| Seven input types; choices, scale, drawings with custom background and photos | Existing active form builder, report inputs and media components retained |
| Conditional questions, progress, draft recovery and offline queue | Existing form conditions, report draft and sync modules retained; offline tests pass |
| Search any season’s events by name/code/city | Event setup searches all official events, with optional team-only filter; `event_code` is included as well as full key/location |
| Select/change event and download teams | Additive event selection, current-event switcher and explicit official-data refresh; existing reports remain event-scoped |
| Random allocation, active/excluded scouts and full assignment breakdown | Scouting → Assignments: one-click whole-team pit/match generation; Custom assignment options save selected/excluded scouts under the assignment revision; All assignments and scout filters show the breakdown |
| Older `event.assignment[userId].teams` allocations | Read-only “Teams assigned in the older version” panel; own team shortcuts and assigned-team schedule/pit filters include these allocations without modifying source maps or inventing form/match metadata |
| Upcoming/completed matches, alliance scores and assigned-team highlights | Event → Match schedule, status/search controls and My assigned teams filter, using both legacy and newer allocations |
| Pit checklist and privileged overview of scouts by team | Pit forms → Pit visit checklist, searchable overview with visitor names and separate pit-report counts; assigned-team filter; Undo visit archives the marker rather than deleting history |
| Older pit markers without event keys | Separate older-visit list; no fabricated current-event coverage |
| Own robot, rankings, team search, automatic event detection, livestream/manual stream and fullscreen | Settings → My team active component retained; explicit chosen event takes priority; dedicated Event → Pit display adds a streamlined stream/schedule view |
| Data by form/team, answer and question search, report details | Teams → Reports: scoped form/team/question/answer filters, original report details and 25-row pagination |
| Form averages/ranges, choice percentages and text counts | Expand Question summaries in Reports. Calculations live in `analytics.js`, with source IDs, missing/invalid counts, one linked-match median per event/team, and separate match/pit evidence |
| Export all or selected-form CSV | Reports exports all filtered rows, not only the visible page, in CSV/JSON. CSV labels include form/question identity and retain unknown answer fields; identical question IDs in different forms do not collide |
| Team settings, tracking enablement, name/number, roles, ownership and member removal | Settings → Manage members and forms; existing controls retained, authorization enforced on the server. Disabled pit tracking is respected without disabling detailed forms |

## Intentional safety differences

The old version cleared reports on event changes, could delete an event and its data, and allowed report deletion. Those destructive behaviors were not copied. Event setup offers report exports and End and archive event / Restore event instead. Reports stay immutable; corrections retain the original record. Form removal and workspace closure archive rather than orphaning reports. These are required by the current project conventions, not missing controls.

Legacy allocations have no form or match metadata. They are displayed and used for team filtering, but are not silently converted to completed reports or conflicting per-match assignments. Generation preserves existing assignment records and original legacy fields. A scout is never assigned two robots in the same match; insufficient scout counts produce an error without partially saving pit assignments.

## Verification

The package unit/API/offline/export suite has 60 passing tests. Added coverage checks legacy assignment scope/deduplication, form/question/answer filtering, media exclusion from answer search, identity-safe CSV columns, zero/missing/invalid handling, and separate pit evidence. API checks cover archived-event generation rejection, visit-history preservation and authorization, non-owner leave/rejoin with reports retained, and owner-leave rejection.

Focused ESLint and production/PWA build are run on active changed modules. All 28 Edge fixture checks pass. The expanded suite includes historical report filters and a real filtered CSV download, pit overview plus undo, legacy allocations and assigned-team schedules, and event archive/restore with unchanged reports. Layouts are checked at 1440, 1280, 1024, 768, 390 and 360 pixels. Browser QA uses synthetic temporary databases only.

UI guidance kept advanced filters and summaries in disclosures, used 25-row pagination, and retained readable table widths inside labelled scroll regions on phones rather than squeezing evidence into narrow columns.

Existing local Vite configuration and pnpm workspace changes were preserved. No production data was modified. Native PowerPoint rendering remains unverified; existing PDF/PPTX package/export tests and browser downloads remain covered.
