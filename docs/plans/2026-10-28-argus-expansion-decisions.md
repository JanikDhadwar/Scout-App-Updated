# Decision record — Argus 5.13.0

The user approved the implementation plan and one compatible release containing the complete feature set. There are no unresolved product choices.

1. Match briefings show opposing robots, reached by clicking a Pit Display match, in a dedicated page. Top three strengths/concerns are ranked by evidence confidence; deeper evidence is expandable.
2. Match13 probability and scores are modest, separate and attributed. No Argus prediction or AI is introduced.
3. Present All means every event team and every existing presentation section, in a continuous viewer plus combined PDF/PPTX. Number order is editable before starting. Summaries prioritize alliance selection. Saved picklist positions are informational; edits remain in the picklist workspace.
4. Snapshots stay fixed until explicit refresh. New reports/picklists show availability of updates. Revocation overrides the snapshot. Names and notes are omitted by default; notes require authorized explicit opt-in.
5. All workspace members can use both features, subject to existing sharing/evidence authorization. Public viewers are excluded.
6. Strength/concern labels need three usable matches. Success-rate defaults are >=80% and <50%, editable by admins. Categorical disputes are excluded; numeric duplicates retain medians. Confidence rules and penalties are fixed/documented, with visible reasons.
7. Last match uses schedule chronology and compares up to three preceding observed matches plus the event baseline. Performance variance is not scout unreliability.
8. Admins choose guidance level. The review is always the final step after questions. Beginner forms default Guided; old forms default Quick.
9. Only Beginner pit and Beginner match templates ship. Copies are separate/editable. Season scoring needs explicit admin configuration.
10. Illustrated answer-key training and private feedback ship alongside free practice. New users receive once-only, skippable first-workspace onboarding; existing users can manually replay Help.
11. Internal architecture is removed from user Help, while repository technical documentation is retained. Useful user-facing role/offline/connection instructions remain.
12. MFA stays optional. Read-data clearing retains local drafts/queues/receipts. Forecast estimates survive outages only under the same scope and ordered alliances, visibly stale after two minutes.

Deferred: AI explanations, an Argus prediction model, public publishing, additional roles, advanced/quick templates, seasonal field packs, video training, and editing picklists while presenting.

No push, deployment or production change is authorized by this implementation request.
