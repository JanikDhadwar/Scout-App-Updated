# Usability and feature parity

## Current changes

- Setup can be dismissed and reopened. Preference is scoped by account and workspace, not shared with other scouts.
- Home has quick actions and collapsible report/coverage details; the next assignment comes first on phones.
- Five main destinations remain. Phone More now has direct links rather than instructions about where to look.
- Settings places a single Blue Alliance/Groq check at the top, with separate results and a last-tested time. Configuration and account controls are disclosed on request.
- Assign pit and match scouting includes every workspace member without checkbox setup. Both lists commit together. Existing assignments remain unchanged; generation only fills gaps. Custom scout/form controls remain available.
- Manual event creation is collapsed. Any official event remains selectable, independent of team attendance.

## Local feature inventory retained

| Capability | Local location / evidence |
| --- | --- |
| Sign in, account creation, join/switch workspaces, roles and ownership | Active local entry and server authorization tests |
| Match and pit forms, conditional questions, required answers | Scouting; form-condition tests |
| Text, numbers, scales, choices, yes/no, photos and field drawings | Active form builder and report inputs |
| Draft recovery, archived unfinished forms, offline queues and reconnect | Device and sync; unit and Edge browser checks |
| Events, official teams/schedules/results/rankings, any-event selection | Event setup; official data API and Edge checks |
| Match/pit assignments, exact report context, submission limits | Scouting → Assignments; server and browser checks |
| Pit visits, stream display, upcoming team matches, display-team settings | Pit forms, Event → Pit display and Settings |
| Team rankings, robot information, team search and manual livestream controls | Settings → My team (legacy active component retained) |
| Team profiles, comparison, explicit metrics, source reports and coverage | Teams; analytics/export tests and browser checks |
| Picklists, strategy, presentation controls, PDF/PPTX and CSV/JSON downloads | Teams; persistence, export and browser checks |
| Local analyst, optional private Groq integration and fallback | Analytics; provider tests, browser checks and real connection diagnostic |
| Team announcements, member management and offline preparation | Settings → Team news / Manage members and forms / Device and sync |

## Live-site comparison limitation

The requested https://6390scout.app was opened read-only. Direct HTTP access returned 403; the browser initially displayed security verification and subsequently reached the Argus sign-in page. A signed-in production workspace was not available. The user was asked to sign in in that tab. No production data was changed, no account was created, and no deployment was performed.

The user subsequently authorized sign-in. Two sign-in attempts returned the visible message “Request failed. Please try again.” No invalid-password message was displayed and the browser error log provided no additional cause. No credentials were saved in project files. The live authenticated comparison remains blocked by the unsuccessful sign-in request.

The table above records local capabilities; it is not a claim that every authenticated live-site feature has been compared. Complete the screen-by-screen comparison after live sign-in succeeds. The local checkout and cached origin/main both point to e7918e2, but that alone does not establish the running production version.

## Historical source comparison completed

The user selected the GitHub rename snapshot as the feature reference instead of the inaccessible live site. See [the complete comparison](rename-version-parity.md) for commit e1a3276, restored gaps, intentional safe replacements and the latest 60-test/28-browser-check verification. Live sign-in is no longer required for that requested historical comparison.

## Verification

60 package unit/API/offline/export tests pass. Focused React ESLint and production/PWA build pass. The 28 Edge fixture checks cover dismissal persistence/reopening, combined whole-team assignments with no duplicates, connection-check feedback, and the existing role/offline/picklist/export/navigation flows. Server tests additionally verify atomic failure of combined generation, default membership selection, non-admin rejection, conflict revisions, connection-check membership and rate limiting. Diagnostics unit tests cover real response validation, missing keys, rejected keys, quota, malformed responses and private-error redaction.

Real connection checks using the workspace's saved private configuration reported Blue Alliance working and Groq working at 2026-10-20 00:48 UTC. Only the fixed test prompt was sent to Groq; keys were not printed. The local server restart expired in-memory sign-in sessions. No real scouting reports were replaced, and no assignments were generated in the real database during verification.

Service references: [TBA API v3](https://www.thebluealliance.com/apidocs/v3), [Groq chat completions](https://console.groq.com/docs/api-reference).
