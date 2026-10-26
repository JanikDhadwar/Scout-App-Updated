# Argus 5.10.1 — live scouting, report browsing and Teams/Present

This release completes the 5.10.0 scope and adds one browser-test reliability fix found during verification.

## Live form limits

Pit entry reads current per-team submission counts when the form opens, every ten seconds while the page is visible, when the window regains focus or the browser reconnects, and after a local report is saved. Team choices show `[MAXED]` from those live counts.

The count is checked again before a report is queued. If another scout filled the last slot, entry stops with the existing draft kept and a message naming the limit. If live counts cannot be read, the page says so and notes that the server still enforces the limit when reports upload. Nothing requires a page refresh.

## Live match status

The schedule checks official results while the Matches page is open. `/api/live/revision` returns an opaque HMAC token over the workspace's event, forms, submissions, memberships, announcements, pit reports, assignments, picklists, allocations, submission states and tombstones. The server clears its read caches when the database file changes, so the token reflects current data without exposing it.

The client polls every ten seconds while the page is visible and skips overlapping checks. Official matches refresh through a bounded service on a shared 30-second cache; concurrent requests share one fetch. The service re-reads the event, preserves unknown fields and existing reports, merges alliance data, and keeps the downloaded schedule when the official source fails or returns an empty list. Only the active event refreshes. A completed match is never inferred from its scheduled time. The schedule footer shows when official results were last checked or why they could not be.

## Report browsing

Reports now starts with View pit forms, View match forms and View all forms. Choosing a type reveals team search and the selected team's evidence; only that team's reports can be downloaded. Legacy scope, form and question filters, summaries and real PDF/PPTX downloads remain. Archived forms with unfinished drafts remain reachable.

## Teams and Present

Present is no longer a separate destination. Teams carries the existing team directory, comparison selection and a red Present action per team. `/present/:id` still opens the same directory with the presentation overlay, so old links work. The sidebar and phone bar use Home, Scout, Matches, Teams and More; the pit display remains linked from Teams and More. Dashboard and help copy no longer mention a standalone Present page. Dead picker and sidebar styles were removed.

## Removed alliance sheet

The automatic alliance selection sheet and generator are gone. Manually managed saved picklists, their ordering, revisions and exports are unchanged.

## Version

`Clasue-scout-app/package.json` and the lockfile move from 5.10.0 to 5.10.1. The live-update browser check now updates its fixture through a page-level `fetch` instead of the test runner's request context, which could return 401 for the fixture session. That change affects the test harness only. Work stays on main; no push or deployment.

## Validation

- 122 unit/API tests pass. New coverage includes workspace-scoped revision tokens, coalesced official refreshes, active-event-only updates, failure retention and live-update polling guards.
- Production build and focused ESLint (`npm run lint:active`) pass.
- All 25 fixture browser checks pass, including live pit limits without refresh, preserved blocked drafts, type-first report browsing, automatic official completion and the removed alliance sheet.
- Screenshots were reviewed at 1440, 1280, 1024, 768, 390 and 360px. The dashboard has no Present shortcut, Teams shows Present actions on desktop and phone, and the report browser starts with the three form-type actions.
- PDF and PowerPoint files download from the report browser. All 10 PDF pages were rendered and inspected in Edge's PDF viewer; no clipped or missing content was found. The PowerPoint file contains 10 slides, but native PowerPoint rendering is unavailable.
- Browser checks used disposable fixture databases. No production data changes, push or deployment.

Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-IhF8dn`.
