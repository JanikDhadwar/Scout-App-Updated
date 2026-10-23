# Local calculations and alliance selection — 5.4.0

## Behavior

Removed the Groq request service, provider controls, key entry and connection probes. The existing analyst now always uses `answerQuestion` in `analytics.js` on the device. The legacy authenticated analyst endpoint also uses that deterministic engine, with existing membership and approved-summary restrictions. No generative provider is called even when an old server environment or private integration file contains a key. Retired private file fields are preserved but cannot be configured or advertised as connected.

Strategy now automatically builds scoring, defense, support and reliability selection sheets from the active event's authorized analytics. Admins/owners map numeric fields to these roles and choose the preferred direction under **Analytics → Metric definitions**. Mappings retain form/question identity and use existing optimistic metric revisions. New seasons require forms and explicit mappings, not changes to the algorithm. Labels never imply categories, point values or phase mappings.

Each field uses the mean of linked-match medians, excluding pit reports and unlinked observations. Within each field, a team's percentile is `100 × (worse peers + (tied peers − 1)/2) / (peer count − 1)`; a single observed team receives 50. Category scores equally average the configured field percentiles. All configured fields need observations for a team to rank. Missing values remain unknown, zero remains zero, ties share percentiles and the home team is excluded. Scores describe relative event evidence, not game points, predicted wins or a guaranteed best alliance. Sample sizes, source IDs, coverage and disagreements accompany the rows. Small samples are flagged without inventing confidence probabilities.

Admins/owners can generate a new editable picklist from any category. Generation does not replace existing lists or save automatically. Normal picklist revision checks, local draft persistence and permissions apply. The live sheet updates as reports change; saved picklist ordering remains manual. Scouters only see their approved measurements and cannot edit shared lists.

## Verification

- 108 unit/API tests pass, including future-year report aggregation, duplicate medians, zero/missing answers, partial categories, ties, private key compatibility and the absence of AI connection calls.
- Active-module ESLint and the production build pass.
- All 19 local Edge browser checks pass, including category configuration, generated picklist save/reload, preservation of prior lists and analyst operation without provider requests. Existing offline reload/reconnection, roles, handoffs, assignments, exports and presentation keyboard checks remain included. Final artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-7JGHrF`.
- Selection-sheet screenshots are captured at 1440, 1280, 1024, 768, 390 and 360px. Tables scroll in labelled, keyboard-focusable containers; team numbers remain intact.
- Export code is unchanged. Browser tests verify real PDF and PowerPoint downloads; native PowerPoint rendering was not performed for this change.
- Real database SHA256 remains `39964648E63AE84BB7CA1D121C98C4E161D67896B8B48165BE4334E4946E4DB7`.
- Work remains local on `main`; no deployment was requested or performed.
