# Red accent and match-launch guide

October 20, 2026. Version 4.1.1 changes the primary action, active navigation, links, focus rings, tabs, auth/form controls and numeric chart accents from blue to red. Blue alliance panels and team badges keep blue because they communicate alliance membership. Red action background #C53645 has 5.27:1 contrast with white text; hover #B92D3B has 6.00:1 contrast. The dark canvas, team records, forms, calculations and queued reports are unchanged.

## Start scouting from a match

1. Load an event and its official schedule in Event data.
2. On Home, find Next match. Alternatively, open Matches, find a match and choose Open.
3. Choose Start scouting, then select the robot you will watch from the labelled red/blue alliance buttons.
4. Confirm Scout team [number]. Argus fills the event, match, team and alliance. A matching assignment opens its assigned form; a single eligible match form opens directly. If multiple forms are available, choose one next.
5. Fill in the actual scouting form and submit. The launcher does not submit a report itself. Offline drafts and pending uploads follow the existing storage/sync rules.

Timing comes from the downloaded schedule. Predictions are labelled estimated; a past scheduled time does not mean a match is live. Without a schedule, the next-match panel is unavailable; forms can still be opened from Scouting.

## Change the active event

Choose Change event in the header, add or select the next event, then choose Export and delete data or Delete data without exporting. Choose whether to keep forms or remove them from new scouting. Save the offered JSON backup if exporting, type the outgoing event key and confirm. Only the outgoing event's data is cleared; local drafts/queues stay on their devices. Cleared-event uploads become conflicts rather than recreating deleted data. The transition screen explains that removed form definitions are archived for unfinished drafts.

## Validation

All 73 tests, the production build and focused ESLint passed. The primary red button colors meet normal-text AA contrast. Fixture Edge browser QA verifies the existing workflows, match launch, event changes and six viewport widths. No production push or deployment is performed by this change.
