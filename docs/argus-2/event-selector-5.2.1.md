# Single event selector — 5.2.1

Compared the event workflow with `e1a3276` (Named it Argus). That version used the event search/season control and a pending-event confirmation, rather than a separate saved-event button list.

Removed Choose the active event and its saved-event buttons from Event data. Official event changes now use the existing season/search/Official event control and Select official event action. Existing saved events are resolved by that control without duplication. The manual-event fallback opens the same confirmation directly after creation or when its key already exists; its old instructions referring to the removed list were removed.

The current non-destructive event activation, server authorization, historical data access and unfinished forms remain intact. This change does not restore destructive behavior from the historical commit. The previous 5.2.0 assignment improvements remain in the working tree. Version and lockfile now report 5.2.1. No production push or deployment was performed.

Verification: all 100 unit/API tests, production build, full active-module lint and 17 local Edge browser checks passed. The activation regression now uses the official selector, verifies the extra chooser is absent, tests confirmation/cancel, and verifies historical reports are retained. Event-picker screenshots were captured at 1440, 1280, 1024, 768, 390 and 360px without document overflow. Artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-1h3jXj`. Export behavior is unchanged; native PowerPoint rendering was not performed. The real database hash is unchanged.
