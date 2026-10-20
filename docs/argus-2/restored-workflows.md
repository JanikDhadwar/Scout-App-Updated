# Restored scouting workflows

## Navigation

The desktop and tablet sidebar scrolls independently. Hide menu and Show menu toggle it, and the browser remembers the preference. The main menu has five destinations: Home, Scouting, Teams, Event and Settings. Related tools appear within their section; existing deep links remain valid. Phones keep Home, Scouting, Teams, Event and More (Settings). The current-event menu includes Browse all events.

## Pit display

The owner sets Display team number in Settings. The setting persists on the workspace and updates the cached signed-in workspace. Open Pit display from navigation or Settings, then choose the current event in the header. The display reads the event's Blue Alliance webcasts and shows the selected team's next ten unplayed matches, with red and blue alliances labelled. It refreshes every 30 seconds and offers manual refresh and full screen. YouTube and Twitch have external links if embedding is unavailable. Missing connections and schedules show explicit status messages and retain downloaded schedules.

## Official events and assignments

Connect the workspace's private Blue Alliance API key in Settings. Event setup automatically loads all official events for the chosen season. Search matches name, event key, city, region and country. Team attendance is not required; an optional checkbox limits results to the configured team. Selection reuses an existing workspace event or adds the event, teams, schedule and webcast metadata without replacing any other event or report. This uses the existing TBA read API connection, not a new myTBA account/OAuth integration.

Assign pit and match scouting generates both types in one server transaction with all workspace members included by default. The default forms are shown and can be changed if several exist. It requires downloaded teams, a schedule and enough scouts to cover simultaneous robots. If there are fewer tasks than members, some members may not receive an assignment. Failure saves neither list; existing assignments and report data are never replaced. Custom assignment options remain available in a disclosure.

Assignments supports match and pit reports, manual edits, and random generation for selected workspace scouts and a matching form. Pit generation balances event teams. Match generation covers robots in unplayed matches, balances workloads and prevents assigning simultaneous robots to one scout. Select enough scouts for the match's robot count. Generation fills gaps rather than erasing or reshuffling saved assignments. Individual assignments retain revision checks; atomic generation checks the event's assignment revision, which also changes on individual assignment writes. A stale generation request cannot overwrite concurrent changes.

Scouts open their assigned form with event, team, form, assignment ID and (for match reports) match number and alliance already selected. Pit visits remain separate from completed reports. Completion requires an actual report from the assigned scout with the appropriate context and form.

## Setup guidance

Setup help explains missing official-data connections, events, schedules and match/pit forms, with links to the next action and role-aware instructions. It opens automatically on Home or when no event exists. Other pages keep it collapsible. Dismiss setup saves a browser preference scoped to the signed-in account and workspace; Show setup help reopens it. Saving connections or creating forms refreshes guidance. Pit display distinguishes unpublished schedules, teams not attending and completed schedules; assignments link to missing forms and schedules. Existing reports are not changed by setup.

## Connection verification and compact pages

Settings starts with Check Blue Alliance and Groq. It performs two real server-side requests concurrently: TBA status and a bounded Groq completion using the configured model. Only a fixed connection-test prompt is sent, never scouting records. Results distinguish working, missing key, rejected key, quota and service/network errors, with a timestamp. Requests require workspace membership, are limited to one per account/workspace per 30 seconds and never return credentials or raw provider errors. Key presence is labelled not tested, rather than connected.

Home keeps quick actions near the top and puts secondary reports/coverage in a disclosure. On phones, the next assignment precedes the schedule. More links directly to assignments, pit scouting, pit display, analytics, strategy and reports. Manual event creation, connection configuration, custom assignment controls and account controls are collapsed until requested. Compact spacing preserves touch targets and keyboard focus.

Real private-workspace diagnostics on 2026-10-20 00:48 UTC confirmed both TBA and Groq working. Keys were not printed. The local server was restarted and its in-memory authentication sessions expired; sign in again. No production changes were made.

## Submission limits

In the form builder, enable Scouter picks team being scouted and set Max submissions per team per event to 1 for a single report per team at that event. Leave it blank for unlimited submissions. Limits accept positive whole numbers. Each event has a separate allowance.

The server enforces limits across all scouts. A scoped counts endpoint returns totals without report contents or scout identities. The form includes queued reports in its known totals and uses downloaded submissions when offline. Offline counts can be incomplete; the server decides the final allowance on upload. Conflicting queued reports remain available for review and do not block unrelated uploads. Retries of an already accepted report keep the same immutable ID and succeed even after the allowance is exhausted.

## Rename-version comparison

The complete feature inventory from the September 14 Named it Argus commit and restored gaps are documented in [rename-version-parity.md](rename-version-parity.md). This includes form/question/answer report filtering, filtered CSV/JSON, question summaries, legacy team allocations, assigned-team schedules, pit visitor overview/undo, leaving a workspace and non-destructive event archive/restore.

## Validation

Implementation and verification performed on main. Existing local vite.config.js and pnpm-workspace.yaml changes were preserved. No push, deployment or real scouting-data replacement was performed.

The local shell has Node but no npm executable. The package-runner wrapper attempted a dependency synchronization and stopped on unapproved optional dependency build scripts. Verification used the exact package scripts' Node entry points instead. Local node_modules links expose already-installed jszip, workbox-window and Playwright dependencies; package.json and package-lock.json are unchanged.

- 60 unit/API/export/offline tests pass using the package test script's Node arguments.
- Vite production build and PWA generation pass.
- Focused ESLint passes on changed active React and model modules.
- Browser checks use Microsoft Edge and a temporary synthetic database, never the real database. They cover navigation, roles, offline reload/reconnection, assignment metadata, saved picklists, presentation keyboard controls, actual PDF/PPTX downloads and layouts at 1440, 1280, 1024, 768, 390 and 360 pixels.
- Restored-feature browser checks cover hiding/reopening the sidebar, persisted display settings, a fixture-only stream embed and team schedule, random pit assignments, and reuse of existing official events. Live third-party streaming availability still depends on the event publisher and a configured TBA connection.
- All 28 Edge browser checks pass. The expanded suite includes checks for five main navigation links, non-attending event import with existing-data preservation, and missing-setup guidance. The livestream check uses a fixture response and verifies the generated embed URL, not an actual competition broadcast.
- All ten pages of the downloaded PDF were rendered with Poppler and inspected. Export content/package tests pass. Native PowerPoint rendering was not performed.
