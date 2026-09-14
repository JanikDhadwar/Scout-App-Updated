# Argus local app

See [the Debian setup guide](../README.md) for installation, automatic GitHub
updates, startup commands, data storage, and logs.

The entry point imports `src/frc-scout-local.jsx`. Firebase is not active.

## Offline scouting

1. Use the server’s **HTTPS** address on each device, sign in, and select your
   team while connected. Offline reopening requires HTTPS (localhost also works
   for development). A plain `http://SERVER-IP:3001` page cannot install the
   offline app shell.
2. Open the sync indicator at the top and choose **Sync & prepare device**.
   Wait until the dashboard says **Ready to go offline**. Forms and cached team
   data download automatically while the app is open, too. Stay signed in.
3. Fill out downloaded forms normally. Drafts, including drawings and resized
   photos, save to this browser. **Resume draft** restores an unfinished report.
4. Submit the report. Argus commits it to the device’s upload queue first, then
   uploads it. The indicator shows how many reports are waiting.
5. Reconnect with Argus open. It checks the server every 15 seconds and when the
   page becomes visible or the browser reports a connection. If the app was
   closed, reopen it to resume uploads, especially on iPad/iPhone. Wait for
   **All synced** before clearing browser data or switching browsers.

The server keeps one row per report ID, so a retry after a dropped acknowledgement
does not create a second submission. Rejected uploads remain on the device with
an error. Use **Download pending reports** as a recovery copy if needed; this
exports unsynced report JSON, not a server database backup. Signing out retains
the queue; sign back in to the same account and team to upload it.

Offline mode supports downloaded data and submitting existing match/pit forms.
Creating/editing templates, team/account management, changing event settings,
and importing fresh Blue Alliance data need a server/internet connection.
Submission limits displayed offline use the downloaded counts and this device’s
reports; other devices may have submitted more since the last download.

Device drafts and pending reports are in IndexedDB, separate from the Debian
server database. Do not clear site data while reports are pending. Browser
private modes, storage limits, or eviction can affect local storage. The sync
panel requests persistent storage where the browser permits it and surfaces
failed writes rather than claiming a report was saved.

The responsive layout uses a sidebar on desktop, a compact navigation rail on
tablets, and five bottom actions (including **More**) on phones. Motion is
disabled when the device prefers reduced motion.

## Conditional questions

In **Forms**, create or edit a form. Under a question, use **When to show this
question → Add condition**, choose an earlier question, then a comparison.

- Any question: is answered / is not answered.
- Yes/No and multiple choice: equals / does not equal a selected answer.
- Text: equals / does not equal / contains (case-insensitive).
- Numbers and ratings: equals, does not equal, greater than, less than, at least,
  or at most. Zero counts as an answer.
- Photos and drawings: whether an image/drawing has been provided.

Example: show **Climb height** only when **Attempted a climb?** equals **Yes**.
Add several conditions and choose whether **all** or **any** must match.
Remove every condition to make a question always visible again.

Rules can reference only questions above them. If you reorder/delete a source
or change its type/options, saving will explain which rule needs fixing.
Hidden source questions never trigger other questions, even “is not answered.”
Hidden questions are not required, and their old answers are cleared when the
branch changes and excluded from submitted reports. Existing forms work as before.

Run `npm test` for server and condition tests; `npm run build` for a production build.
