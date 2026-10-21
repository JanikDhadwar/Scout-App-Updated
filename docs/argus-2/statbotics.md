# Statbotics rankings — 5.1.0

Teams → Global rankings → choose a season → Load global rankings. Leave the team field empty to page through global EPA rankings, or enter a team number to look up its season rating and global rank. Team links open Statbotics season profiles.

EPA is an external model estimate, not an official event standing or an Argus scouting measurement. Upstream rank and team-count fields are displayed directly. Missing values remain unknown. Ratings never enter scouting coverage, exports, picklists or the analyst's report-derived calculations. The displayed fetch time describes retrieval, not official match freshness.

The authenticated server uses fixed Statbotics v3 endpoints, validates numeric query parameters, limits pages to 50, times out after eight seconds, caches successful responses for two minutes and coalesces identical requests. The route limits each signed-in account to 30 requests per minute. No API key, scouting data, notes, photos or scout names are sent. The UI loads only on request and reports service errors without fabricated results or silent substitution of a different season.

Upstream reference: https://github.com/avgupta456/statbotics/blob/master/backend/src/api/team_year.py and its db/models/team_year.py serializer. Both numeric total_points and the prior total_points.mean representation are accepted. Live requests from this machine returned HTTP 500 during implementation; successful display is checked with isolated test responses, not production scouting data.

The user confirmed handoffs are online-only, not restricted to the same physical Wi-Fi network. The newer 5.0 ownership workflow already includes handoff authorization and one-match transfer tests; this update preserves it.

## Verification

- All 99 unit/API tests passed. New checks cover missing values versus zero, numeric and prior mean-shaped EPA data, fixed query validation, pagination bounds, response caching/coalescing, malformed responses and upstream failures. Anonymous API requests are rejected; invalid authenticated requests return 400.
- Production build and focused ESLint passed. Package, lockfile and generated release metadata all report 5.1.0.
- All 16 local Edge browser checks passed, including the new rankings lookup/pagination/error flow, match-only handoff, offline reload/reconnection, roles, ownership, picklists, presentation controls and actual downloads. Successful external responses are explicitly intercepted synthetic QA data; live upstream success could not be verified because Statbotics returned HTTP 500.
- Reviewed final rankings screenshots at 1440, 1280, 1024, 768, 390 and 360px. Wide rankings tables scroll within labelled keyboard-focusable containers without document overflow. Final artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-ybTbeF`.
- Rendered and inspected the exported PDF's first page from the first passing run. Native PowerPoint rendering was unavailable; the downloaded presentation was verified by the existing export checks. Export implementation was unchanged.
- Real database SHA256 remains `39964648E63AE84BB7CA1D121C98C4E161D67896B8B48165BE4334E4946E4DB7`. No commit, push or deployment was performed.
