# Public welcome — 5.5.0

New visitors open a responsive Argus introduction with the purpose, workflow, match/pit scouting, administration, evidence and comparisons, picklists, pit display and presentation exports. Credits name FRC 6390, the Flusters. Log in opens existing account access; Start now opens account creation. About Argus returns to the introduction; hash navigation supports browser back. No external images, fonts, tracking or services were added.

Startup restores the existing authenticated session before choosing the public view. Cached identity and membership checks, offline storage, draft keys, report queues and sync remain unchanged. Prepared scouts bypass the introduction on offline reloads. Public account URLs return authenticated workspace users to the dashboard without changing scouting deep links. The introduction explains that first sign-in and device preparation need connectivity, and reports remain pending until acknowledged.

Version raised from the working tree's 5.4.0 to 5.5.0 in package.json and package-lock.json. Existing unrelated working changes retained. No push or deployment.

Validation:
- npm run build: passed, including service worker generation.
- Focused ESLint (src/frc-scout-local.jsx and src/argus/welcome.jsx): passed.
- npm test: 105 passed, 3 blocked by environment: deployment symlink EPERM, server and upgrade tests localhost EACCES. No test assertions failed before these environment errors.
- npm run test:browser: attempted with temporary synthetic database; local health connection blocked, runner timed out before browser tests. Real database untouched.
- Additional static browser attempt: Edge exited during launch with a named-pipe error. No screenshots were obtained or visually reviewed.
- Added browser coverage for welcome at 1440, 1280, 1024, 768, 390 and 360px, account entry/back, offline public reload, and existing prepared scout root reload while offline. These checks are pending a browser-capable environment, as are the existing role, assignment, picklist, presentation and download checks.
- PDF pages and native PowerPoint rendering were not inspected in this environment.
