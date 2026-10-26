# Argus 5.9.0 release review

Reviewed 2026-10-26. Work remains on main. No production deployment or push was performed. Real databases, private integration files and live competition records were not modified or used as test fixtures.

## Decision

**Not cleared for an unrestricted public all-ages launch.** The technical checks below pass, but operational verification, privacy/contact/consent decisions, and licensing work remain. This review cannot certify legal compliance, incident immunity or protection from lawsuits.

The operator was identified as Janik and FRC 6390 Hephaestus, running the server. Team owners administer their own team accounts; this does not transfer the service operator's responsibilities. No public privacy/security contact exists yet. Operator location and legal status still need clarification.

## Implemented in this update

- Settings → Account security: change username after verifying the current password. Stable account IDs, memberships and assignments remain; submitted reports and historical attribution are not rewritten. Cached reads are invalidated without deleting drafts or queued reports.
- Settings → Account security: create a 192-bit recovery code, shown once. Only its SHA-256 hash is saved. New codes replace older ones. Sign in → Forgot password? consumes the saved code, updates the salted password hash, and revokes all sessions. Email reset is not available; users without an existing code cannot use this recovery method.
- Team owners can replace the team join code after password confirmation. A new 96-bit random code invalidates the old invitation without removing existing members. Custom passwords on team creation require 8–128 characters; generic PATCH cannot replace invitations. Legacy codes remain usable until an owner rotates them.
- Added fixed-window aggregate auth/signup limits independent of username or successful login; bounded the failure map. Added per-account/address/global join limits and account/recovery limits. These mitigate the source-review findings; they are not a claim of DDoS resistance. Password hashing is still synchronous and request bodies can be up to 10 MB.
- Assignment preview/apply/reconcile requests have per-user/global rate limits. Automatic optimization rejects events above 128 teams or 400 matches, and selections above 100 scouts, before scoring. Imported larger events are not deleted; automatic assignment cannot process them under these limits.
- Added explicit `ARGUS_TRUST_PROXY=loopback` support for a trusted same-host reverse proxy. Default remains untrusted. Other values fail startup rather than trusting arbitrary forwarded headers.
- Updated vulnerable locked dependencies using compatible npm fixes. Removed unused `i` and `idn` dependencies after checking source references; `i` had an archived upstream repository.
- Ignored and removed 1,059 generated promotional files from Git tracking with `git rm --cached`; local originals, including the preferred brag.mp4, remain on disk. Git archive exclusions were verified against a temporary archive using the worktree attributes. Historical commits still contain previously committed content.
- Added reproducible third-party dependency notices and links in the public/app footers. The inventory includes build dependencies because generated assets may contain their code. It does not grant a license to Argus or external media. See `dependency-notice-gaps.txt`: 63 installed packages lack a top-level license/NOTICE file and need upstream review; this is an inventory gap, not proof that their licenses are incompatible.
- Included the existing late-scout assignment work from 5.8.0 without overwriting it. Package and lockfile versions are now 5.9.0.

## Verification evidence

- `npm test`: **117 passed, zero failed**. New tests first failed against missing behavior, then passed. Coverage includes single-use recovery, stored hashes, replaced codes, session revocation, duplicate usernames, preserved IDs/reports, invitation owner isolation and invalidation, rotating-username signup exhaustion, join guessing limits, bounded/expired buckets, oversized schedules, and forwarded-address spoofing/default/trusted-proxy behavior.
- `npm run build`: passed. App version and lockfile root versions match.
- Focused ESLint on changed active application/server modules: zero errors. Root-level QA/notices scripts were checked separately using the explicit configuration from the repository root.
- `npm audit --json`: **zero known advisories** across installed dependencies at review time. This is an advisory database check, not proof that dependencies contain no vulnerabilities.
- Supply-chain collector and renderer completed on the final manifest: 22 direct dependencies. See `release-supply-chain-review.md` for measured advisory/maintenance/publisher coverage and unassessable criteria. Publisher concentration is not itself a vulnerability.
- Edge fixture-browser QA: **22 checks passed, zero uncaught browser errors**, including a production-mode run. Coverage includes offline reload/reconnection and saved drafts, role restrictions, assignment ownership and late scouts, handoffs, picklist persistence, presentation keyboard controls, real downloads, username changes and password recovery.
- Responsive screenshots captured at 1440, 1280, 1024, 768, 390 and 360 px; the QA suite found no document overflow. Account Settings screenshots were inspected across all six widths. Generated recovery secrets were hidden before saved screenshots. A focused final browser check also verified the corrected Hephaestus public credit, served dependency notices, and all six public-page widths.
- Exported 10-page PDF rendered and visually inspected. Poppler reported missing optional font substitutions, but the rendered pages were readable and not cut off. PowerPoint download succeeds; **native PowerPoint rendering was not available or verified**.
- Current tracked-file signature scan found no matching Groq/GitHub token or private-key header. This bounded scan does not clear Git history, all credential formats, untracked local files or previously disclosed keys. Revoke any keys previously shared publicly or in chat; do not reuse them.

Artifacts are local temporary files, excluded from Git: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-lkN7P9` (latest production browser run; earlier reviewed Settings/PDF artifacts are in `argus-browser-qa-65raqf`); `C:/Users/Janik/AppData/Local/Temp/argus-release-review-20261026` (dependency collection and rendered PDF pages). Root release logs are ignored. No private user data was used.

## Required before public launch

1. Establish a monitored public contact for privacy, security and deletion requests. Finalize responsible operator identity/location, actual hosting/subprocessor countries, retention and backup expiry, request verification and a real erasure process. Account deactivation currently retains historical reports and backups: do not describe it as full deletion.
2. Resolve the intended under-13 audience with appropriate consent and guardian controls plus qualified advice on applicable Canadian, US and other law. No parental-consent workflow currently exists. A team's join code or ordinary checkbox is not verified parental consent. See `public-notices-draft.md` for facts and official sources. Operator status affects which laws apply; do not claim universal COPPA/PIPEDA/GDPR compliance.
3. Finalize and publish reviewed privacy/terms notices. Confirm code/contributor licensing, resolve dependency notice gaps, API/data redistribution terms and brand permissions. The landing-page team credit was corrected to Hephaestus based on the operator’s clarification. Do not distribute commercial-song trailers without appropriate permissions. Excluding files from the current tree does not remove historical Git copies; history rewriting/takedown decisions require separate authorization.
4. On the real server, verify HTTPS and Secure cookies, private origin/firewall access, single database writer, private file permissions, monitoring/log retention and off-host backups with a restore test. These were not established by local tests. No credentials/access were available for a deployed infrastructure audit.
5. If cloudflared runs on the same server, deliberately configure `ARGUS_TRUST_PROXY=loopback` in the private server environment and restart through the normal deployment process. Verify real clients have separate limits, the proxy appends/overwrites forwarded addresses correctly, and direct origin traffic cannot spoof them. Never set `trust proxy=true` blindly. Without this setting, proxy visitors share address limits; one visitor can exhaust a shared signup/reset bucket. The explicit global limits also remain shared by design. Other proxy topologies require separate configuration/review.

See `release-security-review.md` for source-review scope, trust boundaries and remaining limits. Public deployment remains a separate explicitly authorized action.
