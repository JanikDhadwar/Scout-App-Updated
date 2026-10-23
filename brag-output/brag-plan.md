# Brag plan: Argus

## Planning rubric
1. App: an FRC match and pit scouting app, with offline entry, coordinated duties and evidence-based alliance selection.
2. Strongest claim: scout offline, then build an alliance picklist from the collected match evidence.
3. Visual hook: giant red match number beside a recognizably Argus navy scouting interface.
4. UI: assigned match/team, per-match handoff, numeric scouting form, and categorized selection sheet. Faithful HTML recreations, enlarged for video readability.
5. Shortest satisfying film: 22 seconds, four scenes.
6. Tone: polished; a field-side product film, precise and purposeful.
7. Audio: warm steady music with three quiet UI accents. No voiceover.
8. Caption: Built Argus for the stands, the pits, and alliance selection. Scout offline, coordinate match duties, and turn match evidence into a picklist.
9. Flow: assigned match → record evidence → category-ranked alliance shortlist.

## Angle
From the next match to the next pick. Show the product doing work rather than listing promises. No team logo, gradients, fabricated performance claims or AI references. All names and scouting values are fictional demo data, labelled on screen; they are not competition results. Team numbers 101–106 are illustrative identifiers, not claims about those real teams.

## Identity and output
- Landscape, 1920 × 1080, 30 fps; duration 22 seconds.
- Navy graphite #0B1018; surfaces #151D29; text #F2F5FA; secondary #A7B5C8; red #C53645.
- Platform sans character, reproduced with Arial. Tabular numbers. Restrained borders.
- No narration. No publishing. All creation and rendering local.

## Storyboard
### 1 — Your next match — 0–5 seconds
Large headline “Your next match.” A red “43” sits beside a recreated match assignment showing Team 101, red and blue alliance numbers, and Start scouting. At 2.19 seconds a cursor selects Handoff; an enlarged receiver state changes from pending to accepted. Supporting line: “One team. One scout.” Settled text holds at least 1.8 seconds.
Interaction: handoff selection and acceptance. Audio: one restrained click.
Transition: clean lateral change to scouting.

### 2 — Every observation counts — 5–11 seconds
Headline “Scout. Even offline.” Enlarged match form with Autonomous, Teleoperated and Endgame tabs. A counter increases 4 → 5 → 6; a saved-on-device status appears. Show “Queued for sync” rather than falsely claiming server upload while offline.
Interaction: numeric entry followed by device save. Audio: two low-volume clicks on count and save. Reveal aligns near music cue 8.74s.
Transition: decisive cut into strategy at 11 seconds.

### 3 — Make the next pick — 11–17.5 seconds
Headline “Evidence for alliance selection.” Real category names Scoring / Defense / Support / Reliability. Recreate Scoring selection sheet with three fictional teams, relative score, linked match samples and a small source-evidence line. Rows reveal at 11.46, 12.55, 13.64 seconds, then hold together. The Create scoring picklist button resolves to Picklist draft. Values are illustrative, not actual rankings.
Interaction: rows arrive sequentially; click Create scoring picklist. Audio: soft reveal accent near 13.11s, no sound on every row.
Transition: screen recedes into final product lockup at 17.5 seconds.

### 4 — Argus — 17.5–22 seconds
Large Argus wordmark. “Match and pit scouting.” Bottom line: “Scout. Coordinate. Select.” A compact strip of the three demonstrated UI states remains beneath the wordmark. Final frame holds more than two seconds.
Audio: warm final accent at 17.47s; music fades for final 1.5 seconds.

## Music cue guidance
Bundled happy-beats-business-moves-vol-12-by-ende-dot-app.mp3, about 109.96 BPM. Strong cue targets 8.74, 13.11 and 17.47 seconds. Rows use every-other-beat spacing for reading time. Music at 0.28 with a short opening fade and 1.5-second ending fade. Sparse warm, low high-frequency-risk SFX. No waveform or equalizer. Audio-reactivity optional; omit if extraction is unavailable.

## Grounding
Sources: Clasue-scout-app/index.html, README.md, src/argus/workspace.css, strategy.jsx, analytics.js, workspace.jsx, and existing match handoff and offline behavior documented in instructions. Video artifacts do not change the deployed app or app version.
