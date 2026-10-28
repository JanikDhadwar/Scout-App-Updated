# Device support and first-event field guide

Prepared 2026-10-27. This guide describes current web/PWA behavior and the proposed public support scope. The release evidence ledger records actual completed tests. Do not present the proposed matrix as verified support on devices that have not been tested.

## Browser and installed app scope

Argus is a web application with optional home-screen/desktop PWA installation. Native App Store/Play Store packages are not provided by this release. HTTPS is required for ordinary service-worker/offline use; localhost is a development exception. School-managed browsers may restrict installation, storage, camera, downloads, or notifications.

The proposed baseline is current stable and previous major supported browser releases, subject to actual testing and published exact floors. Prior releases do not automatically become unsupported when a browser updates; review the matrix with each candidate. Maintain a lightweight core scouting path for lower-cost phones and slower venue networks.

| Platform | Verification required before a public support claim |
| --- | --- |
| Windows | Physical Windows device with Edge/Chrome/Firefox; installed mode where offered; keyboard and downloads |
| macOS | Physical Mac with Safari/Chrome and any other advertised browser; downloads and installed mode |
| iPhone | Small/larger physical phones with Safari, browser and home-screen modes; camera, lock/suspend, storage, foreground queue recovery |
| iPad | Physical iPad with Safari, split view, portrait/landscape, hardware keyboard, browser and home-screen modes |
| Android | Low/mid-range and modern phones, plus tablet if advertised; Chrome browser/installed mode, camera/download/storage |
| Chromebook | Managed and ordinary Chrome sessions; keyboard/touch, storage, installation policy and downloads |
| Linux | Physical/distribution/browser versions where advertised; Chromium/Firefox core flow and downloads |

An automated WebKit test on Windows evaluates that engine build; it does not establish Safari/iOS compatibility. Likewise, responsive screenshots evaluate CSS layout, not phone OS storage/camera/background behavior.

## First team setup

1. Open the HTTPS service online. Create a personal account with a unique password; usernames do not need to be real names. Save an account recovery code privately in Settings → Account security.
2. Create the team workspace or join the intended team with its privately shared code. A team number is a claim, not proof of official FIRST identity. Ask the established owner if the number is already registered; do not create a similarly named duplicate to bypass ownership.
3. The owner configures event-data connections privately in Settings if needed. Saved keys are never displayed back to the browser. A key alone does not verify a successful upstream connection; use the connection check.
4. Select/import the intended season/event while online. Confirm its name, season, team list and schedule. A missing/failing official schedule must be shown as unknown/stale rather than invented.
5. Create/review match and pit forms. Set explicit numeric units and phase/metric definitions; question wording is not a scoring formula. Practice entries remain separate from competition reports.
6. Invite scouts privately and assign least-privileged roles. Owners can rotate the join code without removing existing members. Admins coordinate ordinary membership/forms/assignments; only owners manage admin/ownership permissions.
7. Review the assignment preview, apply the expected revision, confirm roster and robot/station context, and use the late-scout/handoff tools for changes. Resolve conflicts before relying on an assignment.

## Prepare every scouting device

1. Online, sign in to the account and workspace that will actually scout. Use the same browser/profile or installed app for the event; local data is not shared across browsers/devices.
2. Open Device/sync and choose **Sync & prepare device**. Wait for the ready state rather than assuming that loading the landing page cached the event.
3. Open the intended forms, event and assigned match context. Check missing fields, required questions, alliance colors/labels, and supported photo/drawing controls.
4. Disconnect Wi-Fi/mobile data, reload/reopen, resume a Practice draft, and save a Practice report. Reconnect with the app open and verify it confirms sync. Do this on each device class before competition.
5. Keep a backup operational plan for unsupported/managed devices, local-storage failure, low battery and lost phones. Do not clear browser/site data or uninstall the app while drafts/pending reports matter.

## During scouting

- Verify event, match, robot/team, alliance, report type and assignment before entering answers. Missing and zero mean different things; enter zero only when observed.
- Drafts save to that device. **Saved locally** requires committed device storage. A pending/queued report is not confirmed on the server.
- If storage fails, keep the form open, preserve visible answers through an available recovery route, and resolve space/permission problems before trusting a save. Do not repeatedly reload hoping an unsaved form is safe.
- If offline, continue using downloaded forms. New templates, team changes, fresh event imports and owner/admin settings need a server connection.
- A pit limit or assignment conflict may reject upload. Argus retains the local evidence; inspect the error and resolve it without replacing another report under the same ID.
- For a one-match substitution, use the handoff flow and acceptance. For a late permanent scout, use the coordinator's preview/apply flow; avoid independent manual assignments that create double ownership.
- Keep the app open after reconnect, especially on iPhone/iPad. Mobile systems can suspend background uploads. Wait for **All synced** before clearing data, switching profiles or retiring a device.
- If an update is available, let draft writes finish. A failed draft save must block a reload; fix storage and retry. Existing queues remain scoped to their original account/workspace.

## Review and decisions

Use Teams for profiles/comparisons and Present, and Reports and export for form-type/team-specific evidence. Review samples, missing/invalid answers, duplicate disagreement, coverage denominator, freshness and source report IDs. Pit observations do not add match performance or match coverage. External estimates are predictions; they do not replace observed evidence or official results.

Picklists require current revisions; if another coordinator edits one, retain your unsaved ordering/notes and resolve the conflict. Presentation supports keyboard navigation and closing back to the prior view. PDF/PowerPoint files contain private scouting information when exported from private records; share only with authorized recipients. Native PowerPoint compatibility needs actual rendering evidence.

## Recovery and shared-device use

- For pending reports, use **Download pending reports** as a recovery copy. This is a device queue export, not a backup of the entire server or proof of upload.
- Return to the original account/team to resume uploads. Signing into another team must not submit or expose the former team's local reports.
- Changing a username preserves stable account IDs and historical report names. Identical retries retain original report attribution; different payloads under one submission ID are conflicts.
- Save the recovery code when generated; only its hash is retained. Generating a new code replaces the previous one. Password recovery revokes existing sessions. Email reset is not offered unless implemented separately.
- A removed member loses current online access. Already downloaded offline information cannot be recalled remotely; protect shared devices and downloaded exports accordingly.
- Archiving a team/form preserves evidence. Account deactivation is not full erasure. Use the adopted privacy request process for deletion/access concerns.

## Reporting a problem

Use the real monitored support channel once the operator publishes it. Provide version, approximate time/time zone, browser/OS/device, feature, visible error/sync state and whether a report is draft/pending/confirmed. Do not send passwords, recovery codes, private API keys, session cookies, or other teams' raw records. Retain unsynced data until recovery is confirmed.

## Reproducing local browser checks

From `Clasue-scout-app`, after building:

```powershell
npm run test:browser
$env:QA_BROWSER='chromium'
npm run test:browser
$env:QA_BROWSER='firefox'
npm run test:browser
$env:QA_BROWSER='webkit'
npm run test:browser
Remove-Item Env:QA_BROWSER
```

Edge is the default. Additional Playwright engines must be installed locally. The launcher creates disposable fixture data, a private empty environment file and a local server; it does not modify production. Artifacts contain synthetic data. Keep a record of engine versions, screenshots at 1440/1280/1024/768/390/360 CSS px, offline tests, downloads and limitations for each candidate.
