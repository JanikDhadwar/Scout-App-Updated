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

[Back to contents](contents.md)
