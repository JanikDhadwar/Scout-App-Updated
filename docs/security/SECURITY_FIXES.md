# Security fixes

## Current hardening increment

- Removed provider-controlled raw HTML rendering from the tracked Firebase prototype. Provider status is plain text.
- Added decoded image validation with canonical base64, raster signature/container, byte, dimension and pixel limits.
- Added optional TOTP MFA for accounts, including encrypted private secrets, confirmation-before-activation, session rotation, replay prevention, hashed single-use recovery codes and bounded pre-authentication challenges.
- Added MFA step-up to role changes, ownership transfer, join-code rotation and integration-secret updates. Mandatory privileged MFA is an explicit operator setting and cannot start while a current Owner/Admin is unenrolled.
- Added private MFA artifacts to ignore rules and documented required configuration.
- Added a release security scanner and CI gate for private artifacts, high-confidence credential forms, raw HTML sinks and server secret names.
- Added regression tests for raw HTML sinks, malformed/spoofed media, MFA encryption, replay, recovery-code consumption, persistence, symlink rejection and the complete login API flow.

## Compatibility

- Existing users, passwords, sessions and roles remain valid until a user voluntarily enables MFA.
- Existing valid PNG/JPEG/WebP data URLs remain supported. A malformed historical value remains readable as stored evidence; new malformed submissions are rejected.
- IndexedDB names, draft keys, queue records and synchronization behavior are unchanged.
- `ARGUS_REQUIRE_PRIVILEGED_MFA` defaults to `false`. Enabling it is a separate production decision, not part of deployment.

## Configuration and migration

Generate the MFA key offline with a cryptographically secure generator producing 32 bytes, encode it as base64, and store it as `ARGUS_MFA_KEY` in the private server environment. Never commit or print the value. Back it up encrypted and separately from the MFA private file. Loss of the key makes enrolled MFA records intentionally unreadable.

The private file `argus-mfa.private.json` is created only on first completed enrollment with mode 0600. It is not stored in the JSON application database. No database schema migration or account reset is required.

## Regression mapping

| Control | Test |
| --- | --- |
| No raw HTML sink | `security-inputs.test.cjs` source scan |
| Media signature/size/dimensions | `security-inputs.test.cjs` image cases |
| Encrypted TOTP and hashed recovery | `mfa-service.test.cjs` |
| TOTP replay and recovery reuse | `mfa-service.test.cjs` |
| Password → MFA → rotated session | `mfa-api.test.cjs` |
| Existing auth/offline/authorization | Full `npm test` suite |
