# Setup

Use Node 22.12 or newer. The active app folder is spelled Clasue-scout-app.

1. Preserve your current database before updating.
2. Run bash scripts/install-debian.sh from the repository root as the normal installation user.
3. Sign in and create or join your team workspace.
4. Owners configure private Blue Alliance and Match13 connections in Settings.
5. Admins add and explicitly activate an event in Settings → Events.
6. Create a pit and match form, then preview permanent ownership in Assignments.
7. Each scout opens Device and sync and prepares their phone before leaving internet access.

Live data stays in ~/.local/share/scout-app/db.json, outside Git and releases. Private credentials and sessions stay beside it. The first persisted upgrade creates db.json.pre-upgrade-v1.bak; keep regular backups as well.

Restart: sudo systemctl restart scout-app

Deploy latest GitHub code: sudo systemctl start scout-update

Read logs: sudo journalctl -u scout-app -u scout-update -n 100 --no-pager

## Account recovery and username changes

After joining a team, open Settings → Account security. Enter your current password, then choose Create recovery code. Save the code privately outside this browser. It is shown once and replaces any earlier code. Anyone with this code and your username can reset your password.

If you forget your password, choose Forgot password? on the sign-in screen. Enter your username, saved recovery code and a new password. A successful reset signs out all existing sessions and uses up the code. Sign in again and create a new recovery code. Email reset is not available. An account without a previously saved code cannot use this recovery flow.

To change your username, enter the new name and current password in Account security, then choose Change username. Your account ID, memberships, reports and assignments stay the same. Existing report attribution retains the name used when the report was created.

Team owners can expand Team join code in Account security and choose Replace team join code after entering their current password. The old code stops working for new joins; existing members keep access. Share the new code privately. Manage existing members in Admin.

To browse submitted reports, open Teams → Reports and export. Choose View pit forms, View match forms or View all forms, then search for a team and open its forms. Legacy and unassigned reports remain accessible through the report scope and unassigned-report action.

[Back to contents](contents.md)
