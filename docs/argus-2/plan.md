# Argus 2.0 implementation checklist

Baseline: commit 8d19ef2. Development branch: main, as explicitly requested. The original database is unchanged; its backup is in the current user's temporary argus-2-rollback directory. Baseline SHA256: 39964648E63AE84BB7CA1D121C98C4E161D67896B8B48165BE4334E4946E4DB7.

## Audit

React 19 and Vite 8 serve a local Express JSON-file API. IndexedDB stores drafts, pending reports, receipts and scoped caches. Existing forms support text, number, scale, boolean, select, photos, drawings and conditional questions. Navigation is local state rather than URLs. There is no verified season scoring model or AI provider.

Critical findings: API permissions currently rely on client UI; generic reads expose all collections. Changing events deletes submissions. Same-ID retries replace records. Existing reports lack event/match/form snapshots. The existing 16 tests pass against temporary data.

## Design

Graphite/navy canvas #0B1018, sidebar #101722, surface #151D29, borders #263244, foreground #F2F5FA, secondary #A7B5C8, primary blue #4266DD with red presentation actions. Red and blue alliance identifiers also include text. Use platform sans typography, tabular numerical values, compact sidebar and structured data tables. No team logo, promotional hero, fictitious metrics or decorative card grids. Mobile prioritizes scouting and team lookup.

## Architecture and order

- [x] P0. Audit frontend/backend/offline contracts, establish branch and database backup, run baseline tests, capture baseline browser screens.
- [x] P1. New routed shell, navigation, current event, real dashboard, matches/team directory, reusable controls and preserved legacy workflows.
- [x] P2. Server-authenticated permissions, additive assignments/picklists/config stores, immutable report retries/CAS, event metadata, global search and confidence foundations.
- [x] P3. Shared deterministic analytics, team profiles, 2–4 comparisons, seven-section presentations, downloadable PDF/PPTX.
- [x] P4. Event picklists and connected strategy, local evidence analyst and disabled provider adapter. No third-party scouting transmissions.
- [x] P5. Unit/API/offline/browser tests, role isolation, all six requested viewport widths, accessibility, real export inspection and final source review.

## Additive data contracts

Preserve unknown database fields and all real records. Add assignments and picklists arrays on first write. Event records can store analytics_config and cached official matches. New reports collect event_key, match_key, match_number, alliance, report_kind, questions_snapshot and assignment_id. Legacy reports stay unassigned. Do not silently classify arbitrary fields into season phases. Stable metrics use formId:questionId, explicit optional phase/unit definitions, missing values as missing and real evidence links. All presentation, comparison, exports and analyst answers use the same calculation module.

## API changes and risks

Session cookies and server-side scope checks replace downloading password hashes. Existing account hashes remain compatible on server login; new passwords use scrypt. Role checks apply to private reports, assignments and strategy writes. Mutable new records use expected revisions and visible conflicts; report creation is immutable. Existing device storage names and draft keys are preserved. Optional official-data access uses a server-side TBA_API_KEY; no credential enters the browser bundle. External AI remains disabled until approved.

## Rollback

Do not deploy or push to a production deployment branch. To undo source work, return to baseline 8d19ef2 after preserving current changes. New collections/fields are additive. Do not restore an old database over newer competition data; compare records before any recovery. No production database is used for tests.

## Validation record

43 unit/API/offline/analytics/export checks passed. Changed active modules passed focused ESLint. The production build passed. The final integrated browser run passed 13 workflow groups and captured 42 screenshots at the six required widths, with no document overflow or uncaught page errors. Final regressions cover archived draft recovery, role isolation and unsaved picklist recovery.

PDF exports were rendered and inspected, including long notes and evidence; no out-of-bounds glyphs were found. PPTX exports were checked as valid packages with editable text and native charts. Native PowerPoint rendering is unavailable on this machine. Official API success cannot be tested without a server TBA_API_KEY; missing-key and invalid-path cases are tested. External AI is intentionally unconfigured.

The real db.json hash remains the baseline hash. No production database writes, push or deployment were performed. The GitHub Desktop backup stash remains available.

## Optional Groq connection

The user authorized a free hosted AI connection. Added a server-only Groq adapter, authenticated event and workspace checks, bounded derived evidence, citation filtering, rate limits and local fallback. No Groq key is present, so no live Groq request was made. Provider behavior is tested with a mock transport. 46 unit/API checks pass; production build and focused ESLint pass. The browser setup and local fallback check passes. Activation requires GROQ_API_KEY in the private server .env and a restart.

Groq activation verified with the user-provided private key and synthetic evidence. The previous default model was unavailable to this account; the active model openai/gpt-oss-20b returned a successful answer with a valid evidence reference. The key remains in ignored .env only. No real scouting data was used for the connection check.

## Release review

The user authorized security checks, commit and push through GitHub Desktop. See security-review.md. Private credentials, databases and generated artifacts are ignored. Dependency audit now reports zero vulnerabilities. Legacy hashes upgrade on successful authentication, login failure counters do not count successful sign-ins, and direct form/event deletions are blocked. Real database integrity is unchanged.

Terminal-free setup is now available in Settings. Owner-only private connection import persists outside release folders. Final verification: 47 automated tests, 15 browser checks, build and focused lint pass. The user will commit and push.
