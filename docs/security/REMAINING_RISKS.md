# Remaining security risks

| Risk | Status and treatment |
| --- | --- |
| Production Cloudflare/TLS/origin configuration | Unverified because the audit client received a Cloudflare challenge. Requires operator evidence before public approval. |
| Offline downloaded data on lost/shared devices | Cannot be remotely revoked. Mitigate with device locks, scoped caches, session revocation and operating guidance. |
| Single-writer JSON scaling | Locking/durability prevent common corruption but do not remove whole-file parse/write latency or disk-capacity limits. Use measured admission caps and monitoring. |
| MFA key custody and recovery | Optional control is implemented, but loss of `ARGUS_MFA_KEY` locks enrolled accounts. Escrow encrypted backups and rehearse recovery before enforcement. |
| Build dependency advisory | Four Low development-only audit entries remain until a compatible upstream fix; production dependency audit is clean. |
| WebP dimensions | RIFF/type/length and byte limits are server checked; legacy VP8/VP8L dimensions rely on browser decoding. Consider a maintained image decoder if hostile public uploads expand. |
| Git-history secrets | A focused, path-only history scan found no private-key, GitHub-token or AWS-key candidates. Broader entropy/provider scanning and any resulting credential rotation still require operator-controlled tooling and provider access. |
| Physical devices and venue networks | Automated browser/offline tests cannot reproduce all iOS/Android storage eviction, captive portals, low-memory devices or shared venue-IP behavior. |
| Availability and monitoring | Local controls exist, but real alerts, backup scheduling, responder coverage and public status/support channels require adoption. |
| Independent review | This implementation has not had an independent penetration test. It should be reviewed before an unrestricted multi-team launch. |

No known Critical or High vulnerability is intentionally accepted by this document. Discovery of account takeover, cross-team disclosure, destructive data loss or a practical authentication bypass blocks release and requires incident handling.
