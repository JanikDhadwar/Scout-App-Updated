# Argus 2.0

## Local development

From `Clasue-scout-app`, run `npm ci`, then `npm run dev`. The Vite frontend proxies `/api` to the local Express server on port 3001. `npm run build` produces the PWA. `npm start` serves that build and the database API.

The server uses `DB_FILE` when configured, otherwise `Clasue-scout-app/db.json`. Tests always use temporary files. Existing users can sign in with their existing passwords. New users receive server-side scrypt password hashes. Restarting the server clears its in-memory sessions, so users must sign in again online. Downloaded reports and drafts remain on their devices.

## Event workflow

Add an event in Event data, then choose it in the header. Manual events work without an integration. To download official teams, matches, results and rankings, set `TBA_API_KEY` on the server and choose Refresh official event data. The server also loads its private, git-ignored `.env` file. The existing key has been configured there locally and verified with TBA. Production needs the same private server setting. The key stays on the server. Existing downloaded data remains usable when official refresh fails.

Admins can create match and pit forms with conditional questions, photos and drawings. Existing uncategorized forms remain available. Reports save drafts on the device and carry their event and match context. Use Assignments to choose the match, team, scout and form. Completion requires a matching confirmed report. Pending uploads remain distinct from completion.

Team profiles, comparisons and presentations use the same calculations. Metric definitions in Analytics let an admin explicitly map a phase and unit. No scoring weights are inferred. Picklists save to the event and retain unsaved device drafts. Reports includes current-event, legacy and all-workspace views, with CSV and JSON downloads.

## Analyst and exports

The evidence analyst supports local summaries, comparisons, numeric rankings and coverage questions. It works without an external model. Unsupported local questions return an insufficient-information result. The optional Groq connection uses a private GROQ_API_KEY in the server .env file. Create a key at https://console.groq.com/keys, add it to .env, then restart the server and sign in again. The default model is openai/gpt-oss-20b; GROQ_MODEL can override it. Keep the Groq account on its free plan for free-tier limits. Groq receives the question and a bounded summary of authorized numeric measurements and report references. Photos, drawings, notes and scout names are excluded. Quota or service failures fall back to local answers. The interface labels generated answers as interpretations and exposes report references.

Open a team presentation to download a real PDF or editable PowerPoint. Long evidence may create continuation pages, so exported decks can contain more than seven pages. The interactive presentation has seven sections.

## Verification

Run `npm test` for API, offline, conditions, analytics, exports, strategy and search checks. Run `npm run build` before `npm run test:browser`. Browser QA creates a fresh temporary database, launches a local server on an available port and closes that server when finished. It uses installed Edge. Set `EDGE_EXECUTABLE` if necessary and `QA_ARTIFACT_DIR` for screenshots and the result report.

No production deployment was performed as part of this redesign. The repository's production updater watches the deployment branch, so publishing the changes is a separate deployment action.

## Production secrets

Keep credentials outside Git and release directories. On the existing Debian installation, place TBA_API_KEY, GROQ_API_KEY and GROQ_MODEL in ~/.local/share/scout-app/argus.env with permissions 600. The server loads argus.env beside the configured DB_FILE, or ARGUS_ENV_FILE when explicitly set. Environment variables take precedence. Local development continues to load Clasue-scout-app/.env. Set COOKIE_SECURE=true for the HTTPS deployment. Private local credentials do not travel through a Git push.

## Setup without a terminal

After the server pulls and restarts, sign in as workspace owner, open Settings and choose Import connection file. Select the private argus-connections.private.json file from your computer. This file is ignored by Git. Argus sends it to your own authenticated server and stores only supported connection values in argus-integrations.private.json beside the live database. Future releases and restarts retain that file. No restart is needed after import. Members can see connection status but cannot view or change keys; owners can only configure their own workspace.
