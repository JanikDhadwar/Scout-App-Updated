# Storage, backup, and recovery runbook

Prepared 2026-10-27. These commands describe a controlled operator procedure, not an authorization to run them against production. The implementation and tests use disposable synthetic directories only.

## Storage contract

The active server uses one JSON database selected by `DB_FILE`. Reports, question snapshots, legacy fields, and submitted photo/drawing data URLs live inside that file. There is no separate submitted-media directory in this implementation. Device-only drafts and upload queues live in IndexedDB and are not included in server backups.

The database remains a **single writer process** design. The server now acquires a private `DB_FILE.writer.lock` before initializing database-dependent services. A second server process for the same canonical database path refuses to start while the owner is live. Do not use cluster workers, horizontally scaled replicas, or external scripts that ignore the lock and mutate the file while the server runs. Per-write atomic replacement does not serialize independent read/modify/write transactions or make a multi-file snapshot consistent. Read-only tools and `createDatabase` itself do not claim server ownership.

`DB_FILE` must name the actual persistent file, not a file symlink. Startup, reads, and writes reject file symlinks (including a path swapped after startup), preventing rename from replacing a symlink and splitting writer-lock identity. Parent directories may resolve normally. Configure the resolved private database file explicitly before upgrading an installation that previously used a symlink; do not move or rewrite competition records merely to suppress the check.

The lock records a process ID, host name, creation time, and random ownership token. Normal exit releases it only if the token still matches. SIGTERM/SIGINT stops accepting connections, drains the HTTP server, and exits; a bounded shutdown deadline stops a stuck process. Port binding failure releases ownership and fails startup. After a hard crash, restart reclaims a well-formed same-host lock only when the old PID is definitely absent. A separate exclusive `.writer.lock.reclaim` guard and repeated owner checks serialize competing restart attempts.

Malformed locks, another host's locks, permission-ambiguous process checks, PID reuse, and a leftover reclamation guard fail closed. They require stopped-writer operator inspection, not an automatic age-based unlock. For recovery, stop all configured service/updater instances, verify the recorded PID is not an Argus writer, preserve the private lock/guard as incident evidence, and move only those verified stale metadata files out of the way. Do not delete the database or `.initialized` marker. Then start exactly one service and check health. The software intentionally refuses ambiguous ownership instead of risking concurrent writes. A shared/network filesystem with unreliable exclusive-create semantics is outside this lock's verified scope.

Writes create an exclusive, unique temporary file in the same directory, flush its file descriptor, replace the database with a rename, and flush the parent directory where the platform supports it. A failed write or rename retains the previously committed database; the temporary file is cleaned up when the process survives. A process killed before cleanup may leave a unique temporary file that must never automatically replace the committed database.

After a successful database read/write, a private `DB_FILE.initialized` marker records that this is an established installation. If the database subsequently disappears, reads and writes fail instead of silently initializing an empty competition workspace. The marker remains alongside the persistent database, outside release directories. Preserve it through deployment. Do not delete it to suppress an error. A new empty installation with neither database nor marker can still initialize normally.

The database directory must be writable by the service identity. POSIX-created directories/files request modes 0700/0600; Windows operators must verify NTFS ACLs because POSIX mode bits do not establish equivalent Windows isolation. Node on Windows cannot provide the same parent-directory fsync semantics as supported POSIX filesystems; the file itself is flushed before rename. Power-loss behavior still depends on the storage/filesystem and requires production-specific verification.

## Backup utility

`scripts/argus-backup.cjs` never loads environment files or defaults to the real database. Source and destination paths must be explicit. Output and restoration directories must not exist; their parent directories must already exist. There is deliberately no overwrite or force option.

Commands below use placeholders: replace them deliberately using private operator configuration. Run from the repository root with the deployed Node runtime.

```text
node scripts/argus-backup.cjs create --db <ABSOLUTE_DB_FILE> --out <NEW_PRIVATE_BACKUP_DIRECTORY> --offline --include-private
node scripts/argus-backup.cjs verify --backup <PRIVATE_BACKUP_DIRECTORY>
node scripts/argus-backup.cjs restore --backup <PRIVATE_BACKUP_DIRECTORY> --target <NEW_PRIVATE_RECOVERY_DIRECTORY>
```

`--offline` acknowledges that **all database writers and configuration updaters are stopped**. The tool also compares source bytes before creating the backup to detect changes during capture, but this does not replace stopping writers. The argument is an operator acknowledgement; it cannot remotely prove the production server is stopped. This utility is suitable for a maintenance-window snapshot. A zero-downtime backup mechanism remains a separate design requirement if the selected recovery targets require it.

The database is preserved byte for byte, including unknown fields, IDs, archived records, and embedded media. Validation checks the supported database shape/schema without rewriting or migrating the captured bytes. The manifest records format, capture time, app version, schema, collection counts, byte sizes, and SHA-256 checksums. Verification rejects changed bytes, unsupported schemas, invalid JSON, mismatching counts, unsafe names, duplicate entries, symlinked files, or unexpected files.

`--include-private` additionally copies these existing files beside the database:

- `argus.env`
- `argus-integrations.private.json`
- `argus-push.private.json`

These files can contain credentials. Keep the entire backup private, outside Git/releases/static roots; encrypt it before transport/off-host storage using the operator's approved mechanism. Without `--include-private`, the output is database-only and cannot be assumed sufficient to restore integrations. A nonstandard `ARGUS_ENV_FILE`, legacy `.env` elsewhere, service-manager settings, TLS/DNS credentials, deployment keys, external secrets, and other operator-managed files are **not discovered or copied**; add them to the protected infrastructure backup inventory separately.

Session records are intentionally never copied or restored. Users must sign in again after recovery. This prevents restoration from reviving old authenticated sessions. The manifest is an integrity inventory, not a cryptographic signature: checksums cannot prove authenticity if an attacker can replace both manifest and files. Use access controls, encrypted off-host copies, and trusted retention/immutability controls.

## Controlled backup procedure

1. Check the incident/release owner and approved maintenance window. Notify users through the established authorized communication process, if required; this document does not send a message.
2. Stop every server/updater process capable of writing `DB_FILE` or the included private configuration. Verify the service is stopped through its actual service manager.
3. Confirm the resolved DB path is the intended persistent path and the output is a new private directory on storage with enough space. Never copy to the public release tree or overwrite an older backup.
4. Run `create` with `--offline` and the explicit paths. Use `--include-private` only for a protected operator backup. A nonzero exit means the backup is not accepted.
5. Run `verify`; retain the result in private operational evidence, without publishing backup contents. Check collection counts against the captured operational inventory.
6. Restart the existing service against its unchanged current database, verify health and recent reports, and confirm it is the only writer.
7. Move a verified encrypted copy off host using the approved storage/access process. Confirm successful upload and a recent recoverable copy; a local copy alone is not disaster recovery.
8. Apply the approved retention/deletion schedule, monitor backup age/failure, and rehearse restore. No backup frequency, retention period, RPO, RTO, or provider is assumed by this implementation.

## Restore drill and recovery procedure

1. Preserve the current service data and incident evidence. If the live server has accepted reports after the backup, do not overwrite it with an older backup.
2. Choose a **new** private recovery directory in an isolated environment with no production network integration credentials in use. Verify the backup's trusted provenance and integrity.
3. Run `verify`, then `restore` into that new directory. The utility verifies everything before creating a destination and refuses an existing destination. It reconstructs the database marker and the selected backed-up configuration, without sessions.
4. Compare collection counts, report IDs, legacy/unknown fields, archived data, media, assignments, and permission boundaries against the backup inventory. Test sign-in and the application using controlled accounts. Do not post synthetic reports into the recovered real dataset.
5. Keep recovered integrations disabled or network isolated during a drill. A restored `argus.env` can contain real provider credentials; never launch a drill server with them active by accident.
6. Reapply verified erasures/retention actions that occurred after backup capture using the protected deletion ledger/process. Review session revocation, credential rotation, notifications, and pending external work before activation.
7. If new reports exist outside the recovered snapshot, reconcile immutable submission IDs and revision conflicts through a separately reviewed process. Do not merge entire JSON files blindly or replace newer reports with older ones.
8. Only after authorization, point the actual service configuration at the validated new persistent path and start exactly one writer. Activation is deliberately not performed by the utility.
9. Verify health/version, permissions, recent evidence and integration status, monitoring, and backup scheduling. Record actual recovery duration and last recoverable confirmed report time.

If a database is corrupt or missing, the server must fail closed. Preserve the original file/marker and any unique temporary files for review; do not rename a temporary file over real records without validating its provenance and comparing acknowledged/newer submissions.

## Local evidence

`Clasue-scout-app/database-durability.test.cjs` exercises established-file disappearance across restarts, observation before first write, corrupt/future schema rejection, simulated rename failure, simulated fsync/quota failure, retained committed data, and retry success. `Clasue-scout-app/backup-recovery.test.cjs` exercises stopped-writer acknowledgement, private versus database-only backup, byte/ID/media preservation, secret-free command output, checksum corruption, path traversal rejection, no-overwrite restoration, session exclusion, changed-during-capture detection, invalid configuration, and corrupt/missing inputs. `Clasue-scout-app/writer-lock.test.cjs` launches real child processes to test a live second writer, normal exit, hard crash and competing restarts, malformed/external ownership, a stale reclaim guard, replacement-token cleanup, port failure, and graceful signal shutdown.

These tests are a reproducible synthetic restore drill. They do not prove off-host backup transport, real filesystem power-loss behavior, production alerts, deletion replay, production RPO/RTO, or actual service-manager recovery. Those require access and an approved operational rehearsal.
