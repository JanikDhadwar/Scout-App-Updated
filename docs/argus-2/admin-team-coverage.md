# Admin team coverage

Implemented in Scout-App-Updated on main, 2026-10-20.

The Admin Needs attention tab groups schedule coverage by event team, with number and nickname/name. Red indicates no active reviewed pit report; yellow indicates completed matches without active reviewed match evidence. Both textual labels appear when applicable. Team details disclose the missed matches and current duty responsibility, plus review-assignment and dismiss actions. Future matches and duplicate reports do not inflate the missing count. Coverage includes schedule slots without generated duties; the separate duty-confirmation count retains its original meaning.

Dismissals live in a separate additive `coverage_dismissals` collection scoped to workspace, event, team and match. They do not create reports, satisfy assignments, or affect analytics. The admin-only API validates the completed schedule slot and expected dismissal revision. Dismissal and restoration are audited, survive restarts, and preserve all scouting evidence. A later real report hides the warning and any dismissal for that slot. Removed/unreviewed evidence cannot satisfy coverage.

Validation: all 92 Node tests, production build, and focused ESLint pass. API tests cover member/foreign-workspace rejection, future-match rejection, stale revisions, dismissal persistence across restart, and restoration. Unit coverage checks pit versus match evidence, real reports after dismissal, removed/unreviewed evidence and unchanged submissions. Browser QA results are recorded below after completion. Production data is untouched.

Browser QA: all 13 checks passed with no page errors, using installed Chromium (`EDGE_EXECUTABLE=/usr/bin/chromium`) because Edge is unavailable in this environment. Checked Admin screenshots at 1440, 1280, 1024, 768, 390 and 360px; automated checks found no horizontal overflow. Dismiss/reload/restore passed through the real UI, alongside offline reload/reconnection, roles, ownership, picklist persistence, presentation keyboard controls, and real PDF/PPTX downloads. Browser artifacts: `/tmp/argus-browser-qa-wwoqq0`. Native PowerPoint rendering was not performed. No push or deployment was made.
