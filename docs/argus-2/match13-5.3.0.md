# Match13 ratings and pit forecasts — 5.3.0

The user selected Match13 instead of Statbotics and requested offseason-inclusive XP, auto, teleop and endgame ratings, geographic ranks and forecasts for the team's pit-display matches. The active UI now uses Match13. The old Statbotics ranking endpoint is retained only for compatibility and is not called by these views.

## Setup and use

The Owner saves a Match13 API key in Settings → Match13 ratings and predictions. A server MATCH13_API_KEY environment setting also works. Saved keys stay in the existing private integration file beside DB_FILE and survive releases. No key is returned to a browser. A missing key produces a setup message; successful live authenticated access cannot be verified until a valid key is saved.

Team profiles automatically show XP, Auto, Teleop, Endgame and global rank for the selected event year. World, country, state/province and district ranks include denominators where available. Global rankings under Teams now lists Match13's XP and phase ratings and supports year, lookup and pages. Profiles of teams outside the event can show external ratings without fabricated scouting evidence.

Pit display follows the team configured in Display settings, lists only its upcoming official matches, and places predicted red/blue scores and that team's alliance win probability underneath each alliance list. Predictions refresh every two minutes independently of the 30-second official schedule refresh. Provider failure clears forecasts but retains the schedule. Missing probability/score fields remain unknown, zero remains zero and negative component ratings are retained.

## Source and calculation details

Source: https://www.match13.com/docs/api and its linked published OpenAPI documentation bundle. Endpoints use `scope=all` for offseason-inclusive ratings and predictions. Auth is server-side Bearer authentication to fixed https://actions.match13.com/v1 endpoints. Routes used: teams/{team}/years/{year}, years/{year}/teams and events/{event}/matches. Match13's published schema supplies xAuto, xTele, xEnd, xp, rank and match pred.redScore/blueScore/winProb.

Match13 provides ratings rather than official names, schedules or alliance colors. Forecasts join by match key and exact participant set to the official TBA schedule. That provider schema does not carry alliance colors, so an alliance-color swap with the same six participants cannot independently be detected. The UI identifies both sources and labels forecasts as estimates.

Geographic XP ranks are derived in analytics.js from the full Match13 ranked season list and TBA team locations/district membership. They are not official district advancement standings. Ties share the same rank. Missing locations are labelled as incomplete coverage; country/state/district data is unavailable when official metadata is unavailable. No regional denominators or visual rating scales are invented.

Requests validate numeric scope, require team membership, bound page sizes and total global/metadata pages, coalesce identical requests and share credential-separated server caches. Ratings/pages cache for ten minutes, full rank cohorts for one hour, locations for one day and predictions for two minutes. Displayed retrieval times do not identify the latest match/model update. A 30-second cohort assembly budget and extended client deadline allow the initial metadata load; errors preserve existing scouting data. Rate-limit responses trigger a credential-specific cooldown. Source failures never expose raw upstream bodies or secrets and do not mark Argus itself offline; network failures still do.

No notes, photos, drawings, scout identities or reports are sent to Match13. Scouting evidence, coverage, exports and analyst calculations remain separate. No changes were pushed or deployed.

## Verification

- All 107 unit/API tests passed, including private key persistence, tenant authorization, provider-body redaction, cache coalescing, bounded global pagination, complete cohort validation, tied regional ranks, missing/negative/zero ratings, forecast participant matching and blue-alliance probability inversion. Match13 service errors retain Argus's online state; actual network failure still marks it offline.
- Production build and full active-module lint passed. Package, lockfile and generated release metadata report 5.3.0.
- All 18 fixture-only Edge browser checks passed. Match13 views use explicitly intercepted synthetic responses to exercise real profile/global/pit controls and outage recovery; no live successful authenticated response is claimed without a key. Scouting ownership, accepted handoffs, offline reload/reconnection, roles, picklists, presentation controls and actual exports continue to pass.
- Reviewed profile and pit screenshots at 1440, 1280, 1024, 768, 390 and 360px. Predictions sit in the alliance column so their values do not require horizontal scrolling in the narrower pit panel. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-NtSg6a`.
- The real database SHA256 remains `39964648E63AE84BB7CA1D121C98C4E161D67896B8B48165BE4334E4946E4DB7`. Native PowerPoint rendering was not performed; export generation was unchanged.
