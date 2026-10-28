# Public operations handbook

Prepared 2026-10-27 for the public readiness work. This is an operating procedure to adopt and exercise; it does not claim that contacts, monitoring, off-host backups, legal review, or production access already exist.

## Operating boundaries

- Run the active `server.cjs` production build with one writer and persistent `DB_FILE` outside the checkout/releases. Preserve the database, its initialized marker, and private configuration during updates.
- Maintain separate local fixture, staging, and production data/configuration. Never copy real scouting data into a public QA artifact or point load/browser tests at the public service.
- Use private environment/configuration files, least-privileged OS accounts, restricted directory permissions, verified HTTPS and the matching trusted-proxy configuration. Never blindly trust forwarded addresses.
- Keep operator hosting/DNS/repository/backup credentials under MFA where available, with privately stored recovery methods and a backup maintainer.
- Pushing the deployment branch activates the updater. A local readiness pass or checklist sign-off is not authorization to push or deploy.
- Readiness evidence identifies its version, revision, environment, date, command, reviewer, and limitations. A tested Windows WebKit engine is not a tested iPhone or Safari release.

## Responsibilities to assign before launch

| Responsibility | Required duty | Current assignment |
| --- | --- | --- |
| Service operator | Legal identity, audience, privacy/vendor decisions, budget, launch approval | Requires operator confirmation |
| Release owner | Candidate evidence, risk dispositions, rollout/rollback decision | Requires named assignment |
| Primary responder | Event-day alerts, containment, service recovery | Requires named assignment |
| Backup responder | Coverage during absence, independent access/recovery drill | Requires named assignment |
| Privacy/security handler | Monitored requests, identity verification, escalation, response tracking | Requires real monitored contact |
| Team owner | Invitations, member roles, team configuration and ownership transfer | Workspace owner role in the app |

Do not publish a fabricated contact, infer a legal organization from a team number, or promise response coverage that nobody has accepted.

## Before an event weekend

1. Review expected concurrent teams/scouts, report/media volume, provider quotas, storage, and measured capacity. Use admission limits if the forecast exceeds validated capacity.
2. Freeze nonessential deployments during critical scouting/selection periods; establish a narrow emergency-fix process and responder availability.
3. Verify the current version/revision, public health, HTTPS/certificate renewal, proxy/origin isolation, host resources, and a single server writer.
4. Check backup age/integrity and a recent isolated restore drill; use the [storage recovery runbook](storage-recovery.md). A copy on the same host alone is insufficient.
5. Test alert delivery to primary and backup responders. Verify the independent status/support channel can be reached during a primary-site outage.
6. Confirm privacy/terms/support notices, supported-device policy, current known issues, and provider/hosting budget limits are accurate.
7. Have teams prepare every scouting device online, then perform a genuine offline reload and sample save in Practice. Practice evidence must stay out of competition analytics.
8. Review scheduled event/season, explicit metric definitions, forms, assignment roster, late-scout procedure, and draft/queue recovery instructions.

## Monitoring specification

Configure actual monitoring privately before launch; this table defines the signals and responses without inventing a production vendor or threshold approval.

| Signal | Useful dimensions | Response |
| --- | --- | --- |
| Availability/health | Public proxy and origin separately; version | Page responder on sustained failure; correlate deploy/provider state |
| Confirmed report failures | Status, bounded endpoint category, time; never raw answers | Treat data loss/false acknowledgement as stop-launch severity |
| Latency/event-loop backlog | p50/p95/p99, dataset size, active clients | Compare to ratified budgets; pause admission before overload |
| Auth/signup/join abuse | Aggregate 429/failures, shared-IP effects | Contain abuse without indiscriminately denying a whole venue |
| Authorization anomalies | Bounded denied-route counts; privileged changes | Review suspected isolation/access incident urgently |
| Disk, memory, CPU, restart count | Host/service and persistent partition | Warn before exhaustion; preserve DB and pending reports |
| Database write/parse/lock errors | Error class and incident correlation | Fail closed; preserve files; do not initialize an empty replacement |
| Backups | Last successful capture/verify/restore, size, storage | Alert on age or verification failure and test off-host retrieval |
| Integrations | Provider, status, timeout/quota, cache freshness | Degrade to cached/local evidence; avoid retries without bounds |
| Costs and storage growth | Hosting, egress, provider, retained media | Warn against approved budget; apply published fair-use policy |

Choose paging thresholds from actual traffic and approved service targets. Test each alert and record who received it. Client queues are device-scoped; the server cannot measure or recover reports that were never uploaded. Do not report absence of server failures as proof that all devices are synced.

## Incident procedure

1. Record discovery time, candidate version, affected functions, observed impact, and incident owner. Preserve sanitized evidence; restrict access to any personal/security material.
2. Classify impact: confirmed/possible data loss, cross-team disclosure, takeover, exposed credentials, or supported-device scouting failure requires immediate containment and launch/expansion pause.
3. Contain the affected path: pause signup/admission, disable a vulnerable optional integration, restrict operator access, or stop the service if continuing would corrupt/disclose data. Preserve offline recovery guidance.
4. Revoke compromised provider/session/operator credentials through the actual authorized systems; removing a key from a current file or Git tree does not revoke it.
5. Establish whether the database is valid and recent acknowledged records are intact. Never replace newer data with an older backup to make the app start.
6. Recover through the rehearsed storage/application procedure. Reconcile newer reports by immutable ID with reviewed conflict handling; do not combine entire JSON snapshots blindly.
7. Assess privacy/security impact and applicable notification duties with the responsible operator and qualified advice. Jurisdiction-specific deadlines must be determined for the actual situation.
8. Prepare factual status messages for the authorized communicator: affected feature/time range, safe user action, current workaround, next update time, and confirmed limits. Sending messages requires separate human authorization.
9. Verify recovery with approved checks, confirm monitoring/backup state, and get a fresh go/no-go decision before resuming admission or deployment.
10. Record root cause, timeline, affected records, corrective tests, follow-up owner/deadline, and evidence-retention/deletion actions. Update the checklist if the incident invalidates an earlier sign-off.

## Support triage

Collect only the minimum needed: app version, approximate time/time zone, browser/OS/device, visible error/status, affected feature, workspace reference, and whether data is draft/pending/confirmed. Prefer synthetic reproduction or a user-redacted screenshot. Never request passwords, saved recovery codes, session cookies, integration keys, or bulk unredacted private databases.

| Request | Safe response |
| --- | --- |
| Report still pending | Keep site storage; reconnect with the original account/workspace and app open; inspect sync error; export pending recovery copy before troubleshooting |
| Account lost | Use previously saved recovery code; if absent, follow a separately reviewed identity/ownership process; do not fabricate email reset or reveal codes |
| Duplicate team claim | Restrict disclosure; verify authorized claimant through an adopted dispute process; no automatic transfer based solely on a matching number |
| Owner absent | Use existing verified transfer/recovery process; require evidence and audit; ordinary admins cannot self-promote |
| Wrong scouting value | Preserve immutable original evidence; submit a correction or authorized reversible removal/review; retain provenance |
| Deletion/privacy | Route to the monitored handler, verify identity proportionately, track applicable deadline; account deactivation is not erasure |
| Device cleared/lost | Explain that never-uploaded reports may be unrecoverable; check server-confirmed evidence and recovery exports; do not promise a server backup has local drafts |

## Privacy request operating procedure

Before this can be used publicly, the operator must approve legal applicability, public contact, verification, retention, deletion/anonymization semantics, and backup expiry. Keep a protected request register with request ID, received date, category, minimal identity-verification result, owner, applicable due date, actions, and completion/appeal status.

1. Acknowledge through an authorized, monitored channel without disclosing account existence to an unverified requester.
2. Verify the requester/guardian/team authority proportionately; do not collect unnecessary identity documents or retain them indefinitely.
3. Scope affected account IDs, memberships, historical attribution, reports/media, audit records, device limitations, processors, and backups. Preserve unrelated teams' information.
4. Apply approved correction/export/erasure/anonymization and retention rules. Explicitly distinguish team archive, account deactivation, irreversible erasure, and historical evidence policy.
5. Record any required deletion replay for retained backups, restrict recovered data, and ensure a restore cannot silently reintroduce erased material.
6. Verify the result across read caches, derived views, exports, integrations and backup lifecycle as applicable. Explain remaining lawful retention and device/offline limitations accurately.
7. Deliver the response through the authorized channel, record completion, and expire request-verification material under the approved policy.

No new destructive deletion command is supplied here: historical attribution, legal retention, and youth-account semantics need operator decisions before erasure logic can be correct.

## Capacity, admission, and pilot policy

The private server environment supports `ARGUS_SIGNUP_ENABLED=false` to pause new accounts and `ARGUS_TEAM_CREATION_ENABLED=false` to pause new workspaces. Existing sign-in, team joining and report uploads remain available. Optional positive-integer `ARGUS_MAX_USERS` and `ARGUS_MAX_TEAMS` cap retained records (archived workspaces still count). Defaults preserve current behavior; no production limit was selected or enabled by this change. Invalid values fail startup. Restart only through the authorized deployment/operations process after changing these settings. Concurrent signup rechecks the cap after hashing so it cannot overshoot it. These are admission controls, not per-team storage quotas or horizontal scaling.

Use `npm run test:readiness` for a short synthetic local workload. It accepts bounded size settings but no caller-supplied target URL/DB/output path, launches its own temporary server, and checks acknowledgement counts, immutable retries/conflicts, retained fields, and team isolation. Its results are not a production service-level promise.

Ratify page/API/local-save budgets and RPO/RTO before public claims. Record hardware, dataset, client concurrency, network, warm/cold cache state, resource use, p95/p99, errors, and queue-drain time. Require event-day soak, upstream-failure, media-volume, shared-IP abuse and burst tests before broad capacity approval. The JSON database remains a single-writer design even after installing the writer guard.

Pilot order: internal physical-device trial, small invited independent-team pilot, broader opt-in beta, then capacity-limited unrestricted launch. Exit criteria include no unresolved loss/isolation/takeover, reliable offline recovery, successful independent onboarding, supported-device coverage, actual restore/rollback, approved privacy/licensing, and measured headroom. No invitation or external announcement is sent by this runbook.

## Deployment and rollback checklist

1. Freeze candidate revision and version; run tests/lint/build/browser checks and review affected scope.
2. Review archive contents, notices, secrets exclusions, persistent paths and private settings; record schema/API/offline compatibility.
3. Confirm current verified backup, rollback release availability, disk/headroom, operator coverage and monitoring.
4. Rehearse candidate and failure recovery in staging with disposable data and one writer.
5. Obtain explicit authorization for the exact production push/deployment. Commit/push/deploy only under that authorization.
6. Activate through the established updater; confirm health/version, cookies/proxy, reads, alerts, and current records with approved operational checks.
7. If startup or integrity fails, revert application code through the rehearsed procedure. Never roll the database back over newer reports. If schema compatibility is uncertain, stop and preserve evidence.
8. Observe upload failures, latency, capacity and queue symptoms; pause expansion on breached gates; record the decision.

Production access, adopted policies, actual alert delivery, and operational rehearsals remain required evidence. Having this handbook is not evidence that those activities occurred.
