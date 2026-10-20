# Match ownership and handoffs

The user requested that scouts can scout only their assigned robots playing in the selected match, and that a scout can offer a one-match handoff to a teammate who has no robot to cover in that match. The recipient explicitly accepts or declines. Match ownership transfers only on acceptance; all other match assignments stay unchanged.

Plan:

1. Resolve match ownership from scoped explicit assignments plus legacy event/team allocations, intersected with the actual match roster. Explicit assignments override legacy allocations for that match only. Conflicting owners require coordinator resolution rather than authorizing duplicate scouting.
2. Enforce ownership in report submission and assignment creation/generation on the server, not only in the robot picker. Keep original reports and immutable retry IDs. Reject stale/off-owner drafts without discarding them. Preserve historical reports even if their current assignment changes.
3. Implement versioned pending/accepted/declined/cancelled/expired handoff records with sender/recipient authorization, match-start/assignment checks, eligibility checks at acceptance, idempotent responses, and persistent match-only transfer. Reject races that would assign two accepted handoffs to the same previously idle scout.
4. Add a Handoff control next to assigned robot numbers, an eligible-scout chooser, incoming requests with Accept/Decline, and status feedback. Transfers require a live server response; no offline request is queued. The meaning of Wi-Fi-only is awaiting the user's clarification (online Argus connection versus strictly the same physical Wi-Fi).
5. Test ownership, legacy allocations, duplicate slots/submissions, foreign-user access, accept/decline, cancellation, races, expired/started matches and exact one-match scope using temporary fixtures. Run unit/API tests, build, focused lint and Edge browser QA at six widths.

Do not push or deploy. Normal offline drafts and queues keep their existing database/store names and account/team scopes.
