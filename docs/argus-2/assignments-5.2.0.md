# Easier team assignments — 5.2.0

Admin → Assignments now starts with Randomize teams and Fill unassigned teams. Randomize previews a balanced reassignment of unlocked teams; Fill preserves current owners and adds missing ownership. Applying is a separate explicit action. The existing server preview fingerprint, permission checks, locked ownership and accepted one-match handoffs remain authoritative.

Choose scouts and forms contains the existing form choices and scout checkboxes with Select everyone and Clear selection shortcuts. Existing event exclusions are respected initially and the selected count is visible beside Randomize teams. Select everyone includes all current members. Both a pit and match form are required as before.

Who scouts each team defaults to By scout, including people with zero teams. By team shows the permanent scout beside each robot. Search accepts scout names, team numbers and robot names; pages contain at most eight rows. Selecting a team shows its current scout and direct owner/lock editor. Existing revision conflicts retain unsaved edits.

Admin's coverage-team dialog already lists permanent and pit scouts; Review assignment now opens that specific team's editor. Admin/Owner team profiles also show the assigned scout and link directly to the same editor. Scouter data access was not expanded. Missing and conflicting allocations are labelled, legacy allocations are read without migration, and foreign-event/team allocations are excluded.

No reports, existing allocation records, offline storage keys or server assignment algorithms were replaced. Changes remain on main without a production push or deployment.

## Verification

All 100 unit/API tests, production build and full active-module ESLint passed. The roster regression covers scoped event/team data, idle scouts, legacy ownership, locks, conflicts and malformed legacy team arrays. All 17 fixture-only Edge browser checks passed, including preview cancellation without database mutation, everyone/clear selection, search, selected-team editing, profile deep links, existing handoffs, offline reload and reconnection, roles, persisted picklists, presentation controls and actual PDF/PPTX downloads. The permanent owner dropdown now has an explicit accessible name.

Reviewed assignment screenshots at 1440, 1280, 1024, 768, 390 and 360px; there is no horizontal document overflow. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-2QKnsO`. Native PowerPoint rendering was not performed; export code was unchanged. The real database SHA256 remains `39964648E63AE84BB7CA1D121C98C4E161D67896B8B48165BE4334E4946E4DB7`.
