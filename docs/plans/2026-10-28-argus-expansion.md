# Argus 5.13.0 approved expansion

Approved by the user on 2026-10-28 after six rounds of product decisions. Baseline: main b47679f, version 5.12.0. Delivery is one compatible update, in reviewable milestones. No push, deployment, production mutation, old-database restoration, or new AI integration is authorized.

## Product decisions

- Open a dedicated match briefing from Pit Display, with Back to Pit Display. Focus on the three opposing robots relative to the configured display team. Show up to three strengths and concerns per team, last-match observations, expandable evidence and accessible trend data. Do not assume an opponent when the configured team is absent.
- Put a modest, attributed Match13 probability and score strip in match details. Keep external estimates separate from deterministic scouting evidence. Do not generate an Argus probability.
- Present All includes every official event team, in number order initially, with keyboard-accessible reordering. Present a continuous frozen snapshot with a candidate summary first, detailed sections, authorized picklist positions, and a read-only Open picklist action. Provide combined PDF/PPTX exports with progress/cancellation in a worker. No-data teams receive one concise overview.
- Omit scout names and free-text notes by default. Authorized owners/admins may explicitly include notes. New data produces an explicit refresh action; confirmed access changes discard old in-memory presentation state.
- Admins choose Quick (on-demand help) or Guided (inline help/examples) per form. Beginner templates use Guided; existing forms use Quick. A nonblocking review always follows every question and precedes submission. Required-field/type validation remains enforced.
- Ship only Beginner pit and Beginner match, previewable and copied into separate editable workspace forms. Use season-neutral capabilities/outcomes and an explicit admin step for game-specific counters and mappings. Never overwrite existing forms/reports/drafts.
- Provide illustrated practice with known answers and private local feedback, without requiring workspace forms; retain free practice. Offer new users skippable role-aware onboarding at their first workspace and manual replay. Never force existing users through a new guide.
- Remove internal architecture from all bundled user Help/search/onboarding; retain repository developer documentation. Share onboarding content with release-bundled Help.
- Everyone means signed-in members of the workspace under existing approved-measurement/evidence permissions. No public sharing or new role is introduced. MFA remains optional, retaining operator-enforced privileged MFA support.
- Keep offline access. Add explicit current-account read-data clearing while retaining drafts, queue and receipts. Cache forecast estimates only for their original scope and ordered alliances; mark stale after two minutes and retain true retrieval timestamps.

## Calculation contract

Use analytics.js as the single entry for profiles, comparisons, presentations, exports and briefing calculations. Internal pure helpers implement the same rules. Metrics retain form/question IDs. Never infer scoring semantics, phases, units, points or preferred direction from labels.

Only confirmed authorized event-linked match observations contribute. Pit evidence, practice, legacy unlinked reports, removed/quarantined/pending reports never increase match performance or confidence. Preserve numeric zero, missing, invalid, unknown and not attempted as different states.

Numeric duplicate reports contribute one median per linked match. Agreeing categorical duplicates count once; disputed categorical outcomes are excluded from rates and exposed as disagreements. Success/failure mappings are explicit. Default success-rate strength is >=80%; concern is <50%; admins can edit. Numeric thresholds require explicit direction/configuration. A strength/concern needs three distinct usable matches. Rank each list by confidence, usable match count and stable metric ID; never invent entries to fill three slots.

Confidence bands: 0 insufficient; 1–2 Preliminary; 3–4 Limited; 5–7 Moderate; >=8 Strong. Reduce one band for >20% missing/invalid eligible match answers, unresolved duplicate disagreement, and >=2 later completed matches without usable evidence. Stop at Preliminary. Subjective-only evidence and unknown schedules cap at Moderate. Show all reasons and denominators. Robot variability is separate from evidence quality. Do not rate scout reliability.

Choose latest recorded match by official chronology rather than upload time. Compare its observations against up to three preceding observed matches and the event baseline. Exclude it from the preceding-match comparison; label sparse comparisons preliminary. Missing phases remain missing. Do not infer individual points or official scores.

## Milestones and interfaces

1. Restore dependencies, save planning/security records, fix unnecessary session writes, verify/fix WebP dimension checks. Done when isolated regression tests pass.
2. Extend analytics_config with validated insight rules, preserve analytics_revision checks, add additive per-team intelligence and bounded authorized result caching. Reuse analytics/evidence routes. Done when exact calculations and role isolation pass.
3. Add template catalog, previews/copy, guidance/hints, explicit mappings and final review. Preserve historical question snapshots. Done when existing/custom/copied forms and old drafts work without replacement.
4. Add opponent briefing and resilient scoped forecast cache. Preserve actual retrieval time and original ordered alliances across cache hits. Done when schedule changes, stale/outage/offline states and source links are truthful.
5. Add presentation queue/model and export worker. Use the same sanitized frozen snapshot/order for viewer and files; terminate worker on cancellation/unmount. Done when real PDF/PPTX downloads and keyboard controls pass.
6. Add scenario catalog/private draft progress, shared learning content, one-time onboarding eligibility for new accounts, and architecture-free Help. Done when practice works without forms and existing users are not automatically prompted.
7. Verify full tests/build/active ESLint, both isolated Edge suites, six-width screenshots, offline/roles/assignments/picklists/downloads, PDF pages, and a 100-team/200-match/6000-report benchmark. Record evidence and native-rendering limitations before any release decision.

Use existing IndexedDB name/stores/keys and JSON single-writer persistence. New fields are additive. Cache by event/configuration/sharing/report/schedule and permission scope; invalidate on confirmed writes and permission changes. Keep cache count and byte budgets bounded. Source history remains traceable and scoped. Do not introduce another database, report ownership model, or provider.

## Acceptance and rollback

Run npm test, npm run build, npm run lint:active, npm run test:browser and npm run test:browser:expansion. Use isolated synthetic databases only. Review screenshots at 1440,1280,1024,768,390,360; inspect PDF pages and validate PPTX structure/downloads honestly without claiming native PowerPoint rendering.

Preserve users, unknown fields, IDs, reports, form versions, draft snapshots, queues/receipts, permanent ownership and accepted handoffs. Roll back application code against compatible additive data; never restore an old database over newer records. Production proxy/Cloudflare/backup/privacy/monitoring evidence remains separately required. Downloaded offline/exported data cannot be remotely erased after revocation.

Implementation and verification: ../argus-2/expansion-5.13.0.md. Security ledger: ../argus-2/expansion-security-5.13.0.md.
