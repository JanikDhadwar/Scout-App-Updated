# Public notices: draft, not ready to publish

Operator identified by the developer: Janik and FRC 6390 Hephaestus operate the Argus server. Each registered team's owner manages that team's members and scouting records. Team ownership does not replace the service operator's responsibilities.

Still required before publication: responsible operator's full public identity and province/country, a working public privacy/security contact, retention and backup expiry periods, a workable deletion/request process, and a reviewed approach to children's accounts. Do not publish a fictitious contact or promise deletion that the implementation does not perform.

## Privacy facts to include in the final notice

- Accounts store username, salted password hash, account ID, creation time, membership and roles. Optional recovery codes are stored only as hashes. Session cookies are HttpOnly and used for authentication. Recovery codes are shown once and must be saved privately.
- Teams store event schedules, assignments, forms, scouting reports and their question snapshots, notes, uploaded images/drawings, picklists, and related audit/history records. Reports identify their scout and may retain the username used at submission. Other authorized team members can see team data according to their roles.
- Devices store downloaded records, drafts, and queued reports in IndexedDB for offline operation. Clearing browser site data can remove unsent reports. Signing out is not a server-side erasure request.
- Deactivating an account disables sign-in and removes memberships; it does not erase historical reports, backups, or scout attribution. Team archiving retains records. A separate verified erasure/request procedure is still needed, including decisions about historical competition evidence and backup expiry.
- The service uses a private server and may use Cloudflare for transport. Confirm actual server country, proxy logs, hosting access, retention, and backup providers before publishing. Do not claim all data stays in Canada without verification.
- Optional official-event and Match13/Statbotics integrations request team/event statistics. Integration credentials remain private on the server. The AI analyst endpoints are retired; do not advertise AI analysis or claim scouting reports are sent to a model.
- Optional browser push notifications store delivery subscriptions and preferences. Review which external push services deliver notifications and describe notification consent/withdrawal accurately.
- Avoid names, identifiable people in photos, contact details, health information, and other personal information in free-text scouting fields. A username need not be a real name. This instruction alone is not a consent mechanism.

## Children and international use

The intended audience includes children under 13. There is no implemented age-aware parental-consent, guardian review/withdrawal, or child-account deletion workflow. This is a launch blocker for the proposed unrestricted all-ages release pending suitable safeguards and review of applicable law. Do not present a checkbox or a team's join password as verified parental consent.

The Canadian privacy regulator generally expects parental/guardian consent for children unable to consent meaningfully, ordinarily under 13. Applicability of particular Canadian federal/provincial laws depends on the operator and activities. US COPPA applicability also depends on the service and operator; nonprofit entities generally are not subject to COPPA, but that is not a blanket exemption from other privacy duties. International availability may introduce additional requirements. Obtain qualified advice about the actual operator, audience and locations rather than making a global compliance claim.

Sources checked 2026-10-26:

- [Canadian OPC: meaningful consent](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/)
- [FTC: COPPA frequently asked questions](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [FTC: COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)

## Terms, permissions and brand review

The final terms should identify the operator, describe the service and user/team-owner responsibilities, explain that predictions are estimates, require rights to submitted media, describe account moderation and service availability honestly, and give a real contact for concerns. Disclaimers are not a guarantee against claims; liability language needs jurisdiction-specific review, especially for minors.

Do not invent an open-source license for Argus without confirming ownership and contributor permissions. The generated third-party notices do not license the Argus code. Review dependency-notice-gaps.txt and upstream licenses, including any required NOTICE text, before distribution. Verify permissions/attribution for external APIs and data sources; an API key alone does not establish redistribution rights.

Commercial music trailers are excluded from future Git tracking and Git archives. Local originals remain. Previously pushed commits still retain their content; history removal or takedowns require a separate decision. Do not publicly distribute Starboy/Cake By The Ocean promotional exports without appropriate music permissions. Confirm rights to robot footage and submitted photos separately.

Use independent-tool wording; do not imply FIRST endorses Argus. FIRST and other names/logos may be trademarks. Review the [official FIRST brand guidelines](https://www.firstinspires.org/hubfs/web/about/policy/first-brand-guidelines.pdf?hsLang=en) before using their branding.
