# Dependency notice readiness

Updated 2026-10-27 after removal of unused dependencies by the main implementation.

- The remaining installed-file inventory gaps decreased from 15 to 1. Four packages already included their full grant in README; ten more now have captured, version-pinned source notices. The 14 exact packages and primary-source provenance are in [the supplement register](../../scripts/license-notices/README.md) and [machine-readable manifest](../../scripts/license-notices/manifest.json).
- The public notice generator now validates package version, declared license, locked npm integrity, captured text SHA-256, safe local filenames, and recorded provenance before using a supplement. New versions reopen gaps automatically. Regeneration needs no network.
- `https@1.0.0` remains unresolved: a manifest-only npm package declaring ISC with no full notice, README, repository, or code. No copyright/license text was invented and no maintainer was contacted.
- This resolves file-discovery gaps, not Argus code ownership/contributor licensing, external data rights, branding/media permissions, or legal certification. Those decisions remain separate launch requirements.

Verification:

- `node --test dependency-notices.test.cjs`: 4 passed. Tests reject wrong versions/licenses/integrities, tampered captures, path traversal and missing provenance, and demonstrate deterministic offline regeneration plus new-version gap reopening.
- The deterministic-regeneration test initially failed because the generator had no callable isolated entry point; it now generates only within the provided fixture roots during tests and does not mutate the repository when imported.
- `node scripts/dependency-notices.cjs`: 1 remaining review gap, recorded in `dependency-notice-gaps.txt`.
- Focused ESLint on `dependency-notices.test.cjs`: exit 0. Generated notice lines have trailing whitespace removed while preserving license wording.

Full-suite and release-candidate validation are recorded by the main implementation after integration.
