# Argus 5.0 release and operations

This increment implements the critical ownership/security workflow and substantial supporting features from the approved upgrade plan. It does not declare every roadmap enhancement or real-device acceptance gate complete. See [progress](../ARGUS_IMPLEMENTATION_PROGRESS.md) for verification and limitations.

## Upgrade safely

1. Back up the live database and private files; do not replace them with repository fixtures.
2. The normal updater installs the locked dependencies and builds the release. The new updater also runs tests before activation. An older installed updater adopts this behavior on its next invocation.
3. First persisted migration creates `db.json.pre-upgrade-v1.bak` without overwriting an existing backup. Migrations are additive and retain unknown fields and historical evidence.
4. Review the active event, imported permanent owners, selected scouts and forms. Ambiguous legacy ownership is not guessed. Preview and explicitly apply allocation changes.
5. Review approved shared measurements. Scouters do not gain access to other people's raw reports. Review flagged old form snapshots before including them in analysis.
6. Use Settings for events, history, reminders and remote-administration guidance. No public shell endpoint exists.

Session hashes and generated VAPID keys are persisted beside the database with private permissions. Keep these files across restarts. Browser push is optional, requires HTTPS, and still needs real-device delivery validation. It never accepts responsibility on a scout's behalf.

Old destructive event transitions and per-match randomization requests return explicit conflicts. Reload old clients after saving/exporting pending work. Draft IDs, offline queues and report retry identities are preserved.

## Remaining acceptance work

Richer training assessments, dedicated media/gallery management and photo publication, extended hardware/accessibility QA, live push-provider checks and sustained multi-client load rehearsal remain follow-up work. Existing form photo capture is retained. Full-repository lint includes inactive legacy code debt; `lint:active` gates the live application and services.
