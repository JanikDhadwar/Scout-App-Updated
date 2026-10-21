# Compact admin coverage and phone workspace

Updated October 20, 2026. Work is on `main`; no push or deployment is authorized or performed.

## Product behavior

The admin attention view now starts with a searchable team-number/name grid, not a list of individual missing match reports. Phones show six teams per page and larger screens twelve. All event teams remain reachable through paging, name/number search and status filtering. Counts describe the filtered set. Unknown schedules remain explicitly unknown.

- Red: a reviewed, active pit report is missing and its warning has not been dismissed.
- Yellow: pit evidence is present or its warning has been dismissed, but completed matches still lack reports.
- Green: no current operational warnings. This can mean actual coverage or explicitly dismissed evidence; the legend and team details distinguish those meanings.
- Grey: pit warnings are resolved, but the schedule is unavailable, so complete match coverage cannot be claimed.

Opening a team shows its permanent owner, responsible pit scout and missed played matches with their current responsible scouts. Accepted one-match handoffs retain their responsibility context. Unassigned/former-member states are labelled rather than guessed. Future matches do not count as missed.

Admins and Owners can dismiss a team's current pit/match warnings together, restore those warnings together, or dismiss/restore individual match warnings. The server checks membership, role, event/team scope and expected coverage revision. A stale snapshot is rejected before changing anything. Dismissals record the actor and enter Activity history; no submissions, report answers, assignments, ownership records, completion totals or analytics are fabricated or modified. Newly missed matches raise fresh warnings rather than inheriting an indefinite team-wide exemption.

The overview refreshes while visible every 15 seconds and on reconnection. Request generations prevent late responses replacing a more recent overview. Failed updates remain errors, not optimistic green tiles. Team detail windows include an error/retry path, native modal focus containment and Escape/Close support. Event/workspace/role changes remount the admin scope.

## Phone and navigation changes

The sidebar lists only Home, Scouting, Teams, Event and Settings. Secondary routes remain in their related Page tools, search and the grouped phone More dialog; none of the tools were deleted. Assignments retain their own phone destination and now have a meaningful clipboard icon rather than the ellipsis fallback.

Phones retain five bottom destinations and readable/tappable controls. Page tools, event summaries, observations and compact-match handoff tools start collapsed. Desktop evidence remains open by default. More groups secondary pages rather than presenting one long flat list, contains keyboard focus and closes on Escape or when switching to desktop width. Pending/incoming handoff requests, connection problems, saved drafts and report actions remain available.

Admin section buttons become one labelled picker on phones. Duty totals, unowned teams, conflicts, handoff history and practice details remain under More progress details. Shared tokens, the current red action styling, input readability and reduced-motion behavior are preserved. The UI skill search did not return a relevant disclosure result after one retry; implementation used the skill's documented navigation hierarchy, content-priority, native controls and touch-target guidance instead of persisting unrelated search output.

## Supporting fixes and verification

The current checkout required `web-push@3.6.7`, already declared in its manifest/lockfile but absent from the local dependency tree. Validation used an isolated temporary installation through `NODE_PATH`; no dependency manifest or lockfile was changed. Normal production installation remains `npm ci`.

Windows rejected fsync on the database's read-only temporary-file handle. Opening that handle as `r+` retains the existing write/fsync/rename durability sequence and passes the migration/restart tests. This does not replace the live database. The offline help bundle was synchronized with its Markdown sources, including the new admin workflow and the checkout's line endings.

The full test script's equivalent Node invocation passes 95 unit/API/offline/export tests. Coverage includes real versus dismissed status, pit priority, future/unknown schedules, deduplicated teams, stale changes, new missed matches after dismissal, account/event isolation, direct-API permission denial, unchanged real reports and persistence across restart. Production/PWA build and active-module ESLint are checked. Fixture-only Edge verification covers the admin and mobile workflows, offline reload/reconnection, role restrictions, assignments/handoffs, picklist persistence, presentation controls and real export downloads. Screenshots are generated at 1440, 1280, 1024, 768, 390 and 360px. Large-event rendering uses a clearly synthetic 48-team response only in the temporary QA browser, never in a real workspace.

The 48-team phone check asserts six visible teams, working next-page/search/status filters, reachable mobile section selection and paging controls above the bottom navigation at 360×844; desktop shows twelve teams per page. Screenshot checks wait for the page and coverage tiles rather than capturing a lazy-loading placeholder. The More/Escape test waits for the asynchronous aria-expanded state update rather than assuming native close and React commit happen simultaneously.

The downloaded fixture PDF was rendered with bundled Poppler and all ten pages visually inspected: headings, source references, footers, charts and wrapped report text remained legible without clipping. Poppler reported missing optional Symbol/ArialUnicode display fonts; no missing glyphs were observed in the inspected pages. This does not validate every language/font combination or native PowerPoint rendering.

## Remaining launch checks

Production-mode staging follow-up: `QA_NODE_ENV=production` runs the existing fixture-only Edge suite with the server's real production environment setting. All 15 workflows passed with zero uncaught browser errors; artifacts are at `C:/Users/dhadw/AppData/Local/Temp/argus-browser-qa-WPDftD`. The suite asserts the session cookie is Secure, HttpOnly and SameSite=Strict. Production now always marks the session cookie Secure, including behind a TLS-terminating proxy; serve public production traffic through HTTPS. This follows [Express production security guidance](https://expressjs.com/en/advanced/best-practice-security/#use-cookies-securely) and does not enable broad proxy-header trust.

Team-detail paging was added after reviewing the low-scroll requirement beyond the main grid. Missing/dismissed matches show four entries per phone page and six on larger screens. Bulk dismiss/restore actions sit above the match list; individual actions and responsible-scout context remain. The synthetic stress check opens a team with 13 missed matches, pages through entries, verifies the bulk action is visible without scrolling, and asserts the entire paged detail fits a 360×844 phone. The rendered stress screenshot was visually inspected. UI/UX guidance influenced the action-first order, native dialog focus, touch sizes and bounded list; existing tokens, typeface and colour direction were retained.

User choice of verification environment: the user allowed choosing the environment. Isolated local production-mode staging was used without provisioning paid infrastructure. A read-only request to the existing public `https://6390scout.app/` returned HTTP 200, `Cache-Control: no-store, max-age=0`, `CF-Cache-Status: DYNAMIC`, and a Cloudflare server header. That checks the public homepage only, not the new uncommitted build, authenticated cookies, private integration credentials, updater execution or rollback. No production writes or login attempts were made.

Release-guard follow-up: the help bundle now stores canonical LF content and its source verification normalizes checkout line endings. Separate checks cover both CRLF (Windows) and LF (Linux); this prevents the Windows-generated help bundle from failing deployment tests after Git checks out the Markdown on Debian. The full suite now passes 97 tests. Deployment already ran tests before activation; it now also runs `npm run lint:active` before building, with an allowlisted lint diagnostic stage. An ordering test verifies install → test → lint → build → activation. The existing ERR trap retains the serving release if a candidate check fails. Shell execution/rollback still requires the target Debian environment; no WSL distribution or Bash runtime was available locally.

Final local verification: all 95 unit/API/offline/export tests and all 15 Edge fixture workflow checks passed. Active-module ESLint passed with zero warnings; the production/PWA build, browser-script syntax check and `git diff --check` passed. The final browser artifacts are retained at `C:/Users/dhadw/AppData/Local/Temp/argus-browser-qa-cwpWfn`. The local page and health endpoint at port 3001 both returned HTTP 200. The branch remained at `86ff5766058ce0153caffe8dfc39adbc124d6953`; these changes are uncommitted, and no incoming Git changes were reset or overwritten.

These changes do not certify an unseen production installation. Preserve a recent backup, validate Debian install/rollback, confirm actual server dependencies, TLS/proxy and private integration configuration, and verify Cloudflare rules/purging on the authorized deployment. Native PowerPoint rendering remains unverified. No production scouting records were used for mutable QA. Keep existing concurrent edits and request explicit authorization before any push or deployment.
