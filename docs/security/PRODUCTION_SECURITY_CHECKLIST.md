# Production security checklist

Complete with an accountable operator and retain redacted evidence. Local tests do not complete these items.

## Before deployment

- [ ] Back up the database to an encrypted off-host location and verify its manifest/checksums.
- [ ] Restore that backup to a new isolated path and reconcile users, teams, reports, assignments and unknown fields.
- [ ] Confirm exactly one Argus writer process and persistent private paths outside release directories.
- [ ] Confirm service account ownership: directory 0700; database/session/integration/push/MFA files 0600.
- [ ] Generate and escrow `ARGUS_MFA_KEY`; never place it in Git, frontend variables, shell history or logs.
- [ ] Leave `ARGUS_REQUIRE_PRIVILEGED_MFA=false` until every Owner/Admin enrolls and stores recovery codes.
- [ ] Run production dependency audit, test, active/full lint, build, browser, accessibility, readiness and backup tests on the exact release commit.
- [ ] Scan the exact Git history and release archive for secrets, databases, private files, logs and fixtures.

## Edge and origin

- [ ] Verify TLS, HSTS, CSP, frame denial, nosniff, referrer policy and permissions policy on actual public responses.
- [ ] Verify session cookies are `HttpOnly; Secure; SameSite=Strict; Path=/` through Cloudflare.
- [ ] Keep Express proxy trust disabled unless a same-host loopback proxy is used; verify spoofed forwarded headers do not change client identity.
- [ ] Firewall the origin port from the public Internet. Confirm direct IP/hostname access cannot bypass Cloudflare controls.
- [ ] Set Cloudflare rules deliberately; CAPTCHA/Turnstile behavior must not block event-day scouts or offline reconnection unexpectedly.
- [ ] Confirm dynamic `/api/*` responses are never publicly cached.
- [ ] Confirm Cloudflare and origin body/time limits are compatible with the validated maximum report size.

## Authentication and operations

- [ ] Enroll all privileged users in MFA, verify at least one recovery code per person from an isolated test account, and escrow operator recovery procedures.
- [ ] Only then consider `ARGUS_REQUIRE_PRIVILEGED_MFA=true`; restart through the approved release process and verify startup.
- [ ] Put GitHub, Cloudflare, DNS, hosting, backup and administrator accounts under their own MFA.
- [ ] Select signup/team admission settings from measured capacity; do not silently enable unlimited public growth.
- [ ] Test venue shared-IP behavior and confirm rate limits do not lock out legitimate scouts.
- [ ] Configure monitoring for availability, 5xx/429 rates, upload conflicts, write failures, disk/RAM, backup age and unusual authorization failures.
- [ ] Name primary and backup responders and publish a support/status channel outside Argus.

## Post-deployment smoke check

- [ ] Confirm `/api/release` matches the intended commit/version and `/api/health` is healthy through the public edge.
- [ ] Use synthetic accounts only to test login, MFA, team isolation, one submission, offline queue/reconnect and logout.
- [ ] Confirm existing accounts, forms, reports, assignments, event history and legitimate sessions remain intact.
- [ ] Confirm no old and new server processes write concurrently.
- [ ] Watch logs/metrics for at least one normal release interval without logging cookies, bodies, notes, photos, recovery codes or secrets.

## Rollback

- [ ] Roll back application code only. Never restore an older database over newer scouting records.
- [ ] Keep the current database/private files and verify the prior code understands the current schema before rollback.
- [ ] If compatibility is uncertain, stop writes, preserve evidence, use offline scouting, and restore service in an isolated copy first.
