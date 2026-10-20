# Offline and synchronization

Before a competition, open Argus online, sign in and choose Device and sync → Sync & prepare device. Wait for the app shell and downloaded data to be ready.

Drafts, queued reports and receipts are stored in IndexedDB on the original device/account/workspace. A report is complete only after server confirmation. Lost acknowledgements retry the same immutable ID instead of creating duplicates.

Keep the browser's site data. Do not clear storage to fix an update while reports are pending. Export pending reports first. One conflicting report must not prevent unrelated uploads.

Handoffs and administration require a server connection. Cached role information never grants backend permission. Reconnect, sign in if needed, review rejected uploads and refresh data after role changes.

App updates invalidate read caches without deleting drafts or queued reports.

[Back to contents](contents.md)
