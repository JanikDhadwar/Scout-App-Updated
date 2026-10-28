# Public deployment threat model and permission review

Reviewed locally 2026-10-27 for 5.11.0. This is a source/test model, not a production penetration test or security certification. Use the release evidence document for actual command results and remaining external gates.

## Assets and actors

Protect immutable scouting reports and embedded media, original device drafts/queues, historical form snapshots, team strategy and notes, assignments/picklists/revisions, memberships/roles, account/recovery/session secrets, provider credentials, private backups, and deployment control.

Actors include anonymous visitors, legitimate scouts on unreliable/shared networks, malicious members, analysts/admins/owners, removed users retaining offline copies, external API/push services, compromised operator accounts, and competing/stale local processes. A team number or invitation establishes a claim/membership under the app's policy, not an official identity certificate.

## Trust boundaries

| Boundary | Enforced contract | Local evidence | Residual requirement |
| --- | --- | --- | --- |
| Internet → proxy/origin | HTTPS, intentional proxy trust, bounded requests, same-origin writes | Safe headers, origin/proxy/body tests | Verify real TLS, firewall, forwarding and shared venue IP behavior |
| Anonymous → account | Server-side salted hashes, aggregate limits, bounded async work, single-use recovery | Password worker, account, async-sequencing tests | Ratify registration/audience/abuse policy and operator recovery |
| Cookie → identity | Opaque HttpOnly cookie, hashed private token keys, enabled current user | Account/API tests; production-mode cookie browser check | Real host cookie/proxy behavior and session-file permissions |
| Identity → workspace/role | Membership and role checked on server/direct API | Cross-team API, upgrade, load and browser tests | Full independent endpoint review and production access audit |
| Workspace → report/edit | Stable context, immutable IDs, expected revisions | Server, offline, assignment, picklist tests | Real event workflow and operational change policy |
| Browser → device storage | Original user/workspace scopes, committed saves, retained errors/queues | Offline client and draft persistence tests | Physical device eviction/quota/suspend and shared-device policy |
| Service worker → storage | Public build precache; no private runtime image cache; guarded reload | Emitted-worker and draft-flush tests | Installed physical devices and old deployed cache transitions |
| Server → persistent files | One writer, atomic synced file replacement, established-file fail closed | Durability, writer-lock, backup tests | Host power-loss/ACL/disk/restore/off-host verification |
| Server → provider | Private keys; bounded authorized event/team requests; retired AI | Integration/service/push tests | Terms, quota/cost, actual enabled providers and privacy agreements |
| Source/build → production | Reviewed release, version/lock parity, private state outside archives | Build/tests, ignores, deployment diagnostics | Branch protection, credentials, deploy/rollback rehearsal and approval |

## Permission matrix

All entries require current authenticated membership unless explicitly public. “Allowed” still means scoped to the selected workspace and action-specific checks.

| Action family | Anonymous | Scout/member | Admin | Owner |
| --- | --- | --- | --- | --- |
| Landing/login/signup/recovery and public release/health | Public routes only | Public routes | Public routes | Public routes |
| Account rename/recovery-code generation | Denied | Own account + password | Own account + password | Own account + password |
| Workspace create/join | Sign-in required | Own account; valid invitation for join | Same | Same |
| Raw scouting evidence | Denied | Own permitted records; approved shared measurements | Scoped team evidence | Scoped team evidence |
| Match/pit report submit | Denied | Own identity + correct form/event/assignment | Same context rules | Same context rules |
| Report overwrite under existing ID | Denied | Identical retry only | Identical retry only | Identical retry only |
| Reversible report moderation/history | Denied | Denied | Scoped admin routes | Scoped admin routes |
| Assignment plans/forms/picklists | Denied | Read scoped duties; request/accept permitted handoff | Scoped authorized mutations + revisions | Same |
| Ordinary membership administration | Denied | Own non-owner leave only | Ordinary scout management as defined | Manage permitted roles |
| Grant admin/change owner | Denied | Denied | Denied | Owner-only; transfer requires password and recipient acceptance |
| Private integration configuration/join-code rotation | Denied | Denied | Denied | Scoped owner-only; password where required |
| Integration status/data | Denied | Scoped connection flags/authorized data | Same | Flags/data, never saved key values |
| Practice/preferences/reminders/push | Denied | Own scoped state | Own scoped state | Own scoped state |
| Analyst endpoints | Denied before authentication | Retired: 410 | Retired: 410 | Retired: 410 |
| Host/update control | No app-role grant | No app-role grant | No app-role grant | Team owner is not automatically a host operator |

The generic collection API is not a permission escape hatch: users/protected fields and reserved IDs are rejected, membership/role scope is enforced, assignments/forms/reports add contextual rules, and legacy unprefixed aliases are unavailable. Read collections are filtered before serialization. Administrative paths in `upgrade-routes.cjs` and push/reminder paths apply domain membership/role checks in addition to common session handling.

## Abuse and failure cases reviewed

- Rotating usernames, successful-login bucket reset, invitation guessing, oversized auth bodies, malformed JSON, hash-work floods, and unbounded concurrent auth. Existing aggregate limits remain; async work is capped at two active derivations plus sixteen queued jobs, with explicit 429 overload.
- Async stale snapshots: login/signup/recovery/account/ownership handlers re-read authoritative state after password work before mutation/session creation. Concurrent account mutations must not overwrite newly committed reports or resurrect revoked authority.
- Report same-ID replay after a username change: compare authorized immutable content using original attribution, keep the original report/name, and reject actual changed answers.
- Missing/corrupt/future DB, failed writes, disk/fsync/rename faults, competing writers, crashed writer restart, malformed lock, ambiguous process identity, and DB-file symlinks. Ambiguity fails closed; the application does not invent an empty replacement.
- Backup corruption/path traversal, unsafe restore destination, configuration inconsistency, restoring sessions, unknown-field/media loss, and overwriting newer records. Tooling verifies before restore and refuses existing targets; real private snapshots require stopped writers and approved handling.
- Shared image caches and service-worker reload before/after failed draft writes. Legacy image caches are removed without deleting queues/drafts; failed draft writes remain recoverable and block update reload.
- CSV formula prefixes after whitespace/control characters and in headers, metadata or answers. Text is preserved after an apostrophe; native spreadsheet importer behavior remains a manual compatibility check.
- Errors containing malformed body snippets/private paths: request errors emit bounded category/status and server-generated correlation IDs, not raw exception text, body, cookie, URL/query, or caller-supplied IDs.
- Unsafe push destinations, stale reminder delivery, upstream failures and retired AI configuration. Do not re-enable a model/provider or transmit additional data based on an old private key alone.

## Source and operational limits

This model does not prove every endpoint/input combination is tested, that all upload decoders are safe, that all export formats are accessible, or that production settings match local defaults. Current request-size bounds do not eliminate malicious expensive authorized work. Synchronous whole-JSON reads/writes remain an event-loop and capacity constraint even with asynchronous password hashing.

Rate limits are shared by address and global budget as designed. Many scouts behind one venue IP may contend for those limits; local small-workload success is insufficient to approve a worldwide signup burst. Tune only with measured abuse/fairness evidence and a stated admission policy. Uploaded media is accepted as bounded raster data URLs; exhaustive malicious image/dimension fuzzing and native decoder testing remain separate work.

Already downloaded offline information cannot be remotely erased after access revocation. Deactivation is not erasure, and archived forms/reports remain deliberately retained. Operator identity, youth/guardian safeguards, retention/deletion replay, public contacts, legal permissions, external agreements and international audience policy remain operator/review gates, not conclusions of a source audit.
