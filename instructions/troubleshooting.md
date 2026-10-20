# Troubleshooting

Old interface: finish current work, then use Load new version. Avoid clearing browser storage when reports are pending.

No assignments: confirm the active event and ask an Admin to review permanent ownership and generated duties.

Two teams at once: request one-match cover from an eligible connected scout. If no one can accept, inform the coordinator; do not pretend both robots are covered.

Report blocked: keep the draft/queue, read its error and export it from Device and sync. Check membership, assignment, form version and report limits.

Server update failed: sudo journalctl -u scout-update -n 100 --no-pager. Check local Git changes, Node version, disk and RAM. Live data belongs outside Git. Never hard-reset a live database or overwrite newer records with an older backup.

Restart only the app: sudo systemctl restart scout-app. Check status: sudo systemctl status scout-app scout-update.timer.

Remote administration: use SSH over Tailscale; no public shell is embedded in Argus.

[Back to contents](contents.md)
