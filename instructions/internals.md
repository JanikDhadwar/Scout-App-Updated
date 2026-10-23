# Internal architecture

The deployed entry is Clasue-scout-app/src/main.jsx → frc-scout-local.jsx. React/Vite serves a PWA; Express server.cjs owns authorization and JSON persistence.

Canonical team_allocations store permanent owners. assignments store effective pit/match duties. Accepted handoffs update a single duty and append responsibility_history. Legacy event.assignment is a compatibility mirror, not a second editable owner source.

The database migration is additive, retains unknown fields, and creates a pre-upgrade backup before the first write. JSON mutations use one process and synchronous writes/rename. Do not run multiple independent application writers against one file.

Audit entries are stored with mutations and contain operational metadata, not passwords, API keys, report answers or images. submission_states records reversible removal; original submission IDs stay immutable.

IndexedDB scout-device-v1 retains cache/queue/drafts/meta/receipts. Practice queue entries use the practice endpoint; existing real report payloads and draft keys remain compatible.

All profile/comparison/analyst/export calculations use analytics.js. Blue Alliance and Match13 keys are private server settings. Run npm test and npm run build in Clasue-scout-app. Browser tests run only against temporary local fixtures.

[Back to contents](contents.md)
