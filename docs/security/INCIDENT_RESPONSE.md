# Incident response

## First actions

1. Assign an incident lead and start a UTC timeline. Preserve relevant logs, release SHAs and configuration metadata without copying secrets or private scouting content into public tickets.
2. Protect scouting continuity: tell teams to keep devices, drafts and pending reports intact and continue offline. Do not clear browser storage.
3. Contain the smallest affected surface. Pause signup/team creation, disable a compromised integration, revoke affected sessions, or take the public edge into maintenance as appropriate. Do not erase evidence.
4. Preserve the live database and private files read-only. Never restore an older database over newer acknowledged reports.

## Credential or account compromise

- Revoke affected Argus sessions, reset the password through the reviewed recovery process, rotate MFA recovery codes and re-enroll MFA if its secret may be exposed.
- For leaked TBA/Match13/Cloudflare/GitHub/hosting keys, identify exposure scope and rotate through the provider. Update private configuration only through the authorized operations process.
- Review role, ownership, integration and report-removal audit events. Do not assume password rotation reverses earlier data access.

## Cross-team disclosure

- Disable the affected route or public service, preserve request IDs and the exact release, and determine which teams/records were accessible and for how long.
- Engage the accountable privacy/legal contact to assess notification duties based on actual jurisdictions and affected people. Do not invent a universal deadline.
- Fix the authorization root cause and add a regression using synthetic teams before service restoration.

## Database corruption or loss

- Stop the writer and copy the corrupt/missing state, marker, lock metadata and relevant logs for evidence.
- Verify the newest encrypted off-site backup. Restore only to a new isolated directory and reconcile record counts, IDs, unknown fields, permissions and recent acknowledgements.
- Determine whether devices hold newer pending reports. Restore service without overwriting those queues and allow immutable-ID synchronization.
- If recovered data and newer server data diverge, perform an explicit reconciliation; never choose a backup merely because it starts successfully.

## Lost or stolen scouting device

- Revoke the account/session and remove membership if necessary. Previously downloaded offline data cannot be remotely erased.
- Preserve other devices' queues. Change shared invitations if exposed and review access history.

## Recovery and follow-up

- Validate health/version, authentication, team isolation, one synthetic report, offline reconnection, backups and monitoring before reopening.
- Communicate confirmed facts, affected scope, mitigations and remaining uncertainty through an independent status channel.
- Complete a blameless post-incident review with root cause, detection gap, response timeline, corrective owners and due dates.
