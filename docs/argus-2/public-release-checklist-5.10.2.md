# Argus 5.10.2 — public release planning

Prepared 2026-10-27.

## Changes

- Added [public-release-checklist.md](public-release-checklist.md): 283 unchecked acceptance items across 25 sections, including 24 release gates, an owner/reviewer/evidence register, final go/no-go criteria, and suggested work order.
- Grounded the checklist in the active app/server, existing release/security/dependency reviews, public notice draft, current PWA configuration, and project conventions. Linked official privacy, accessibility, and application-security references. Historical evidence is labelled separately from current launch verification.
- Included multi-team authorization, youth/privacy decisions, real-device support, offline durability, concurrent editing, data integrity, FRC season/event context, analytical provenance, integrations, exports, capacity, backup/restore, incident support, licensing, pilots, and deployment safety.
- Capacity and recovery thresholds are explicitly proposed targets requiring approval and measurement, not claims about current production capability.
- Incremented package and lockfile version from 5.10.1 to 5.10.2 as required for every delivered change. No application behavior was changed.

## Verification

- `npm test`: 122 passed, zero failed.
- `npm run build`: exit 0, including service-worker generation.
- `npm run lint:active`: exit 0.
- `npm run test:browser`: all 25 Edge fixture checks passed, exit 0. These exercise offline reload/reconnection, roles, assignments/handoffs, picklists, presentations, downloads, live status, and account recovery using a temporary database/server.
- Browser QA captured required widths 1440, 1280, 1024, 768, 390, and 360 px and asserted no document overflow in its responsive cases. Public welcome screenshots were visually inspected at all six widths; no clipping was observed.
- The downloaded 10-page PDF was rendered with Poppler and every page visually inspected; text/charts were readable without clipped content in this fixture. Poppler emitted missing optional font-substitution warnings. PDF accessibility and real-device compatibility remain checklist items.
- PowerPoint download is covered by the browser suite. Native PowerPoint rendering was not performed or verified; the checklist explicitly requires it before making that compatibility claim.
- Browser/export artifacts: `C:/Users/Janik/AppData/Local/Temp/argus-browser-qa-1KsVO7`. Fixture data: `C:/Users/Janik/AppData/Local/Temp/argus-qa-TN9JDA`.

These checks verify the documentation/version update and existing regression behavior. They do not clear the 283 readiness items, certify legal compliance, validate production infrastructure, establish fleet capacity, or complete physical-device testing. No real competition database was used or modified. No push, public publication, or deployment was performed.
