# Argus feature audit

Baseline inspected: `618b962` (4.2.0), 2026-10-20. This records pre-upgrade facts;
see [progress](ARGUS_IMPLEMENTATION_PROGRESS.md) for implementation results.

React 19/Vite 8, Express 5 `server.cjs`, single-writer JSON `DB_FILE`, scrypt and
HttpOnly SameSite cookies. Active entry is `src/frc-scout-local.jsx`, not Firebase.
Debian systemd release updater, health rollback and optional edge purge.

| Feature | Baseline | Sources/gap |
|---|---|---|
| A permanent assignment | Partial | scouting-rules.cjs randomizes per match; match-access.js supports older event.assignment lists; no locks |
| B roles | Improvement needed | server.cjs checks roles; ManageTab and /manage Owner-only; immediate transfer |
| C Admin control | Partial | operations.jsx, ManageTab, PitVisits and report-library.jsx scattered |
| D handoffs | Working, extend | match-handoffs.cjs and JSX: accept/decline/cancel, presence, revisions, expiry/start guard |
| E practice/training | Missing | No isolated domain |
| F analyst | Working, extend | analyst.jsx, analytics.js, analyst-service.cjs: local + optional bounded Groq |
| G event/history | Critical gap | event-transition.cjs deletes outgoing data; MyTeamTab auto-event overrides selected |
| H assignment UI | Improvement needed | operations.jsx table; legacy allocations separate; no canonical ownership |
| I alliance | Working, extend | strategy.jsx: saved revisioned picklists, notes/reorder, comparison/exports |
| J mobile | Partial | workspace.css responsive shell and five destinations; visual re-verification required |
| K onboarding | Partial | setup-guidance.jsx is setup checklist, not role walkthrough |
| L in-app guide | Partial | contextual text only |
| M instructions | Missing structure | README/docs/argus-2 exist, contain conflicting auth/event claims |
| N reminders | Partial | foreground handoff inbox only; no push |
| O activity | Missing | per-record revisions/timestamps only |
| P notes/photos | Working, extend | report-media.jsx and analytics-views.jsx; inline images; no publication controls |
| Q data checks | Partial | form-conditions.js/client required checks; API lacks complete answer validation |
| R reliability | Working, preserve | offline-client/store.js, use-report-draft.js; immutable retries/queue receipts |

Database collections: users, teams, memberships, forms, submissions,
announcements, scout_events, pit_scouts, assignments, picklists; internal
match_handoffs/report_tombstones. No SQL tables. Sessions in memory.

Baseline checks: 79 tests pass, production build passes. Full lint: 54 errors,
15 warnings (including inactive Firebase files). Browser run blocked because
Edge was absent. Source UI inspection is not a screenshot-verified audit.
No production database or actual deployed release was inspected.
