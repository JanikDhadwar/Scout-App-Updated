# Argus 5.8.0 — add a late-arriving scout

Admin → Assignments now has Add a scout. Refresh the member list, select a scout who has no teams, preview their assignments and apply. The existing Fill unassigned teams action could not help once every event team already had an owner.

The new server plan mode first gives unowned teams to the selected newcomer(s). It then transfers only the number needed to reach a floor share of event teams per participating scout, choosing from the largest unlocked donor loads and preferring fewer future match collisions. It never swaps teams between existing scouts. Locks and existing reconciliation protections for completed reports, accepted handoffs and explicit/manual duties remain intact. Insufficient unlocked teams produce a warning. This is a team-count share, not a guarantee of identical match workloads or zero collisions.

The existing preview fingerprint, Admin authorization, immutable report identity, assignment revisions, audit trail and retry request ID remain enforced. The plan preserves the configured pit and match forms. No automatic changes occur simply because someone joins; the coordinator reviews the transfers first.

Version 5.8.0. Work stays on main. No push or deployment is authorized in this task.

## Validation

- 113 unit/API tests pass, including minimum transfers, unowned-first allocation, a member joining after the first plan, preservation of configured forms, locks, completed reports, accepted handoffs, stale previews, permissions and idempotent retries.
- Production build and focused ESLint pass.
- All 21 fixture browser checks pass. The new flow previews without mutation, applies one transfer to the late scout, preserves the other owners and reports, and refreshes the roster. Existing offline reload/reconnection, roles, picklist persistence, handoffs, presentation keyboard controls and real downloads remain covered.
- Add-a-scout screenshots reviewed at phone and desktop sizes; automated overflow checks run at 1440, 1280, 1024, 768, 390 and 360px. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-W6qZkk`.
- All exported PDF pages were rendered and inspected. Native PowerPoint rendering is unavailable; successful file download was verified.
- Browser tests used disposable local fixture databases only. No production data changes or deployment.
