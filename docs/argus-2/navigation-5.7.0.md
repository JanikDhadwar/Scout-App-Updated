# Argus 5.7.0 — task-first navigation

The old category sidebar plus Page tools repeated destinations and made assignment management appear in two different places. This update uses direct desktop task links and five phone destinations: Home, Scout, Teams, Present and More. Tablet sidebar labels remain visible rather than becoming icons alone. More shows its links without nested disclosures.

Scout is the entry for personal duties and links to match/pit entry. Permanent ownership editing is only in Admin → Assignments. Deep links to assigned forms, drafts and historical records remain intact. Teams links to comparisons, event statistics and reports. Present is a visible destination with a searchable team picker, individual team Present actions and a separate Pit display link.

The analyst is absent from navigation and the app bundle. Old analyst endpoints return HTTP 410 after authentication. An old analyst bookmark explains where to find team statistics. Legacy private integration fields are preserved without being used. No account, report, queue, draft or competition record is removed.

Version increments from 5.6.0 to 5.7.0. Work remains on main; no push or deployment is performed.

Validation results are recorded after the fixture browser run. Native PowerPoint rendering is unavailable; download generation is checked, and exported PDF pages are inspected with Poppler.

## Validation

- 108 unit/API tests pass; production build and focused ESLint pass.
- All 20 fixture browser checks pass, covering roles, authorized shared evidence, report/draft preservation, offline reload/reconnection, handoff acceptance, assignment revisions, picklist persistence, presentation keyboard controls and real downloads.
- One additional focused browser pass verifies Present at 1440, 1280, 1024, 768, 390 and 360px; no document overflow, unbroken Present buttons, one active desktop task link, mobile More dismissal and presentation launch from a team row.
- Full-app screenshots at all six widths are retained in `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-V8bt37`. Final Present/More screenshots are in `C:/Users/Janik/AppData/Local/Temp/argus-navigation-visual-5.7.0`.
- Inspected all 10 PDF pages using a rendered contact sheet. PDF and PowerPoint files download successfully; native PowerPoint rendering was not available.
- No push or deployment. Tests used disposable local databases only.
