# Roles and permissions

Scouter is stored internally as member. Owners inherit Admin and Scouter capabilities. Admins inherit scouting capabilities.

- Scouters submit reports, view assignments, request/accept one-match handoffs, practice, and view approved shared measurements. They can read their own raw reports.
- Admins manage forms, reports, permanent ownership, coverage and ordinary Scouter membership. They cannot promote users or change Owner/Admin membership.
- Owners manage Admin roles and private integrations. Ownership transfer requires the current Owner's password and the recipient's acceptance within 15 minutes. The previous Owner becomes Admin.

The backend checks permissions on direct API requests. Removing membership preserves existing reports and local drafts, but that user cannot upload until authorized again. A role change cannot erase already observed information; downloaded reads are invalidated on a confirmed change.

[Back to contents](contents.md)
