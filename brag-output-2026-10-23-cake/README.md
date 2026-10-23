# Argus — Cake By The Ocean reveal

This is a new musical edit of the user's preferred `brag-output-2026-10-23-044114/brag.mp4`. It preserves that video's design, scenes and illustrative demo panels. Neither the earlier video nor application code is overwritten.

## Music and pacing

The supplied DNCE recording is used from approximately **0:38.489 to 1:12.789**, covering a short lead-in and first chorus. Bass-band onset analysis of the actual file measured **119 BPM** with an estimated 0.17-second beat phase. The revised fast edit runs **34.3 seconds** at 30 fps. The delivered file is `argus-cake-fast-private.mp4`; the earlier slower `argus-cake-private.mp4` is superseded.

The timeline was rewritten for this track rather than reusing the Starboy animation timing:

- Homepage devices reveal on consecutive beats in a two-second opening.
- The chorus brings in the exact four-second robot shot (67–71 seconds of the original MOV).
- A measured beat near the scoring moment triggers a short camera impact.
- Scouting counters, defense answer, saving and reconnect status have individual musical cues.
- Assignment preview/apply, handoff acceptance, conditional form, comparison, prediction callout, picklist and exports change on the beat grid.
- Product camera framings change on every beat, approximately every half-second, during the feature sequences. Headings and demo disclosures remain fixed outside the camera crop.
- An eight-shot, four-second feature montage leads into the ending.
- The site reveal holds for more than two seconds.

`audio-analysis.json` records measured audio events. `timeline.json` records source offset, scene boundaries and major action cues. Beat placement is rounded from each index independently to the nearest video frame, avoiding cumulative rounding drift.

## Feature coverage

| Trailer time | Feature |
|---|---|
| 0:00–0:02.067 | Homepage on laptop, tablet and phone |
| 0:02.067–0:06.067 | User-supplied 6390 REBUILT footage, normal speed, once |
| 0:06.067–0:10.100 | Illustrated scouting counters, defense answer, offline save and upload confirmation |
| 0:10.100–0:14.133 | Assignment preview/apply and accepted one-match handoff |
| 0:14.133–0:18.167 | Pit visits, conditional forms, notes and robot photo |
| 0:18.167–0:22.200 | Analytics, comparison, sample/source confidence, Pit Display/Match13 callout |
| 0:22.200–0:26.233 | Role-based alliance picklist, presentations and PDF/PowerPoint actions |
| 0:26.233–0:30.267 | Eight feature shots, one per beat |
| 0:30.267–0:34.300 | Argus/site reveal, three devices, Practice, Reminders, Roles and Offline help |

The original illustrative panels remain labelled. Example values are not measured counts from the robot footage. This revision does not add new product capabilities or replace the scenes with the rejected browser-recording design.

## Private review

This soundtrack version is for **private review**. Music synchronization and recording rights have not been confirmed. No publishing, deployment, Git commit or push is performed.

## Editing and rendering

- `composition/index.html`: scene mounts and song.
- `composition/compositions/`: individually editable scenes.
- `composition/assets/`: organized visual and audio assets.
- `build.cjs`: reproducible edit from the preferred original composition and the supplied local MP3.
- `analyze.cjs`: beat measurement from the locally extracted bass-band PCM.

In `composition`, run `npx hyperframes preview` to edit, or `npx hyperframes render --quality delivery --fps 30 --output ../argus-cake-fast-private.mp4` to render.
