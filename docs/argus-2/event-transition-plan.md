# One active event per team

The user requested one event at a time, removal of the workspace concept from the interface, and deletion of only the outgoing event's data when changing events. Accounts and team permissions remain isolated. Older unrelated events and records with unknown event context are preserved.

Implementation:

- Add a server-owned active event on each team. Legacy teams resolve their first non-archived event deterministically until their next transition.
- Add an owner/admin preview and transition API. Preview exports the outgoing event, reports (including media), pit visits, assignments, picklists and form definitions without user hashes or integration secrets. A fingerprint prevents deletion after any affected data changes. One atomic database write deletes the outgoing event's scoped records, clears its imported schedule/analytics, records a cleared-event marker and activates the selected event. Already cleared events reject new report writes so delayed uploads cannot recreate deleted data.
- “Delete forms” removes active form templates from new scouting by archiving them. Definitions remain available solely for historical records and unfinished local drafts, consistent with the project's offline requirements. Form IDs and draft keys are unchanged.
- Gate every event selection path with a native modal: export-and-delete or delete-only; keep/remove forms; named event confirmation; Cancel. Export must be explicitly confirmed saved before deletion. Show pending local uploads; never delete drafts or queues. Invalidate read caches only after confirmed server success.
- Replace workspace terminology with team terminology in user-facing copy. Preserve internal team IDs, API compatibility, memberships and credentials.
- Verify API authorization, concurrent-data conflicts, exact event/team scope, cleared-event late writes, form retention, downloadable exports and cancellation in temporary fixtures. Run tests, build, focused lint and fixture Edge browser QA with six widths. Keep production untouched.

No commit, push or production deployment is authorized by this plan.
