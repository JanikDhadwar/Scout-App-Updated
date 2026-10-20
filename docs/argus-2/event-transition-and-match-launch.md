# Event transitions and reference-led scouting screens

Historical 4.x implementation record. **Superseded in 5.0:** event activation now preserves outgoing data; destructive legacy calls are rejected. See [current release notes](argus-5-release.md) and [event instructions](../../instructions/events-and-history.md).

October 20, 2026. The user requested one event at a time, deletion of the outgoing event's data with an optional backup, optional removal of forms, removal of workspace terminology, and a denser dark scouting interface with a match-launch panel based on supplied references.

## Event changes

The current event comes from the team's server-owned active event, with a deterministic fallback for legacy teams. Selection from Event data, official imports and event links opens the same Change event dialog. The header links to this flow instead of exposing a per-device event selector. Other devices refresh the shared active event with team data.

`event-transition.cjs` builds a scoped preview and JSON export containing the outgoing event, reports including media, pit visits, assignments, picklists and team form definitions. It includes no accounts, password hashes, join password or integration credentials. A fingerprint covers the affected data and templates. Any concurrent report/template change invalidates the confirmation, requiring a fresh preview/export.

A confirmed server transition clears only the outgoing event's records, empties its known schedule/rankings/analytics fields, records a cleared-event marker and activates the target event in one database replacement. Unrelated teams, unrelated events, legacy records with no event context, unknown fields and unknown stores remain. A receipt makes a retry after a lost acknowledgement safe; IDs of deleted reports are reserved so retries cannot recreate them in another event. Cleared-event reports and visits return a conflict, retaining queued local copies. After the first explicit transition, report writes and assignment generation must use the shared active event.

“Delete forms from new scouting” archives active templates rather than destroying definitions needed by unfinished drafts and historical evidence. The UI explains this. Local drafts, IndexedDB names/keys, queues and receipts are never removed. Pending uploads are explicitly excluded from the server backup, with instructions to sync/export first. Cancellation never writes the transition. Administrator authorization is enforced for both preview and deletion, including direct API calls.

Backup download is a real JSON download. The user must confirm that it was saved, type the outgoing event key and submit deletion. JSON export is a durable evidence backup, not an implemented automatic import/restore workflow. No real event was cleared during development.

## Interface and match launch

Shared styling uses the existing navy/graphite tokens, compact sidebar/header, red primary actions (updated in 4.1.1), denser operational panels, labelled alliance badges and schedule tables. Desktop exposes scouting destinations directly; phones retain five bottom destinations and More. Team terminology replaces workspace language in the main interface while internal tenant IDs and permissions remain compatible.

The dashboard exposes source-backed observations and a match-sample distribution. `eventMetricDistribution` lives in the shared analytics module, preserves zeros and uses already-deduplicated linked match medians; pit and unlinked samples are excluded from this chart. Per-team averages show sample counts and link to the team evidence. No mock scoring weights, fabricated rankings, win rates or live-field status were introduced.

The match launcher shows the actual red/blue teams and downloaded schedule timing. Predicted times are labelled estimated, elapsed schedules are labelled elapsed, and missing time stays unavailable. Start scouting opens a keyboard-contained robot chooser. The resulting report route carries event, match, robot, alliance and any matching assignment/form. A single eligible match form opens directly; multiple forms remain an explicit choice.

## Verification

- All 73 unit/API/offline/export tests passed, including reproduced failures for malformed transition requests, stale previews, unsafe report-ID reuse and missing chart bounds.
- Focused ESLint and the production/PWA build passed.
- Final Edge run: all 31 checks passed, with no uncaught browser errors. Artifacts are in `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-L7ci3w`.
- Fixture-only Edge coverage includes cancellation, focus containment, downloaded event backup content, both deletion choices, both form choices, shared event persistence across reload, match filters, selected robot/report context, roles, assignment context, picklist persistence, offline reload/reconnection, PDF/PPTX downloads and all existing workflows.
- Screenshots at 1440, 1280, 1024, 768, 390 and 360px cover dashboard, schedules, team/analytics/settings pages, match launcher and event-transition dialog. Tables scroll inside labelled regions; the document fits each viewport. Screenshot review caught missing chart bounds and wrapping team numbers, both corrected.
- Real database SHA-256 remains `39964648E63AE84BB7CA1D121C98C4E161D67896B8B48165BE4334E4946E4DB7`. All mutable checks use temporary fixture databases. No commit, push or production deployment was performed by the agent.
- PDF pages and editable PPTX exports use the unchanged shared export implementation. Browser downloads pass; native PowerPoint rendering remains unavailable and was not claimed.
