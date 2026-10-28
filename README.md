# Argus — FRC Team 6390 Scouting App

**Argus** is an FRC scouting workspace developed by Team 6390 (Hephaestus), available at [6390scout.app](https://6390scout.app). Teams collect match and pit evidence in isolated workspaces, with offline scouting on prepared devices.

Start with the [instructions](instructions/contents.md), [first-event and device guide](docs/argus-2/device-support-and-field-guide.md), and [public release checklist](docs/argus-2/public-release-checklist.md). Public availability for every team/device is subject to the checklist's verified support, privacy, capacity and operational gates; an existing deployment is not evidence that all gates are cleared.

## What it is

A web app for FIRST Robotics Competition scouting — collecting match and pit data on other teams so the drive team can make informed strategy and alliance-selection calls.

## How it works

1. **Sign in** — team members log in; roles (owner / admin / member) control who can see and manage what.
2. **Build forms** — admins create custom scouting forms (e.g. "Qual Match Scout") with multiple question types and conditional logic, so follow-up questions only appear when relevant.
3. **Pick an event** — the app pulls the real match schedule and team list from The Blue Alliance API.
4. **Scout matches** — scouters fill out forms per match, per team, from their phones. Data saves offline and syncs when there's a connection.
5. **Pit scout** — walk the pits and check off teams you've covered, with each record tied to who scouted it.
6. **Analyze** — the Data tab turns all submissions into rankings and team-by-team breakdowns for strategy talks, plus a News tab for team announcements.

## Under the hood

- React 19 + Vite frontend, optional PWA installation — offline support via service worker and IndexedDB
- Express server (`server.cjs`) on port 3001 with a JSON-file database (`db.json`) — no external database needed
- Live competition data from The Blue Alliance API

Create an account and create or join your team. Demo accounts are not provisioned by default.

---
# Argus — Debian self-hosting

The active app is `Clasue-scout-app/src/frc-scout-local.jsx`, served by
`server.cjs` on port **3001**. It saves scouting data to a JSON file on your
server. The Firebase component is not used.

Firebase, JSON-server and CORS packages used by historical/unused entries are no longer installed. Those entries remain as source history/reference and are not supported launch targets. Run the active `npm start`/`npm run build` commands. Server authentication is same-origin and needs no permissive CORS middleware.

Before operating publicly, adopt the [operations handbook](docs/argus-2/public-operations-handbook.md), rehearse the [backup and recovery procedure](docs/argus-2/storage-recovery.md), and complete the [release evidence](docs/argus-2/public-readiness-evidence.md). The operator must supply actual contacts, legal/audience decisions and production verification; these are not invented by the implementation.

## One-time setup on your existing Debian server

1. Commit and push these changes to GitHub first. The updater builds committed
   code from `origin/main`, not uncommitted files.
2. SSH into Debian as the normal user who owns the repository. Install Git,
   curl, sudo, util-linux (flock), and Node.js **22.12 or newer** with npm.
   Ensure `node --version` and `npm --version` work for this user.
3. Stop the old PM2 instance before migrating so it cannot keep port 3001 or
   write to the old database after it is copied. The old deployment script used
   root's PM2, so run:

   ```bash
   sudo pm2 delete Scout-App
   sudo pm2 save
   ```

   If you started PM2 without sudo, use `pm2 delete Scout-App` and `pm2 save`
   instead. Disable any old cron job or webhook that invokes the old deploy
   script. Do not stop unrelated PM2 applications.
4. In the repository root, preserve your database before pulling, then install:

   ```bash
   cd ~/Scout-App-Updated  # replace with your actual repository location
   mkdir -p ~/.local/share/scout-app
   chmod 700 ~/.local/share/scout-app
   if [ -f Clasue-scout-app/db.json ] && [ ! -f ~/.local/share/scout-app/db.json ]; then
     cp Clasue-scout-app/db.json ~/.local/share/scout-app/db.json
     chmod 600 ~/.local/share/scout-app/db.json
   fi
   git pull --ff-only origin main
   # Cloudflare credentials are optional; installation works without them.
   bash scripts/install-debian.sh
   ```

   Run the installer **without sudo**; it requests sudo for system setup itself.
   If Git reports conflicting local edits, preserve and resolve them before
   retrying; do not hard-reset your live database. For a private repository,
   configure this user's Git SSH key or credential helper so `git fetch origin`
   works without prompting. Use a repository/home path without spaces.
5. Open `http://SERVER-IP:3001`, or your existing reverse-proxy/Tailscale URL.

To use another branch or port on installation:

```bash
DEPLOY_BRANCH=main APP_PORT=3001 bash scripts/install-debian.sh
```

Installation does not require Cloudflare credentials. To enable automatic edge-cache purging later, configure the [optional private Cloudflare deployment settings](docs/argus-2/deployment-cache.md).

## What happens after a push

`scout-update.timer` checks the configured branch every minute (and shortly
after reboot). New commits trigger a fast-forward pull, `npm ci`, tests, a production
build, and a restart of `scout-app.service`. The updated deployment script adds the test gate; an already-running older updater adopts it on its next invocation. Multiple pushes between checks
deploy the latest commit. No public GitHub webhook endpoint is needed. Each healthy
release purges Cloudflare when credentials are configured, before deployment is marked complete. Browser and CDN
responses use no-store; new builds refresh offline app caches without deleting
scouting drafts or pending uploads. See [cache behavior and setup](docs/argus-2/deployment-cache.md).

Builds happen in separate release directories. The current app keeps running
during installation/build. Only a completed build is activated. The updater
checks the running release's `/api/health` endpoint and switches back to the
previous release if startup fails. Failed attempts are retried on later checks.
The first installation has no previous release to restore. Database changes
are not rolled back; future schema migrations need their own backup plan.

The services start automatically after reboot. Updating requires internet;
the running app continues serving local data without GitHub access. Open
browsers receive an update prompt so a reload does not discard an unsaved form.

## Start, restart, status and logs

```bash
sudo systemctl start scout-app
sudo systemctl restart scout-app
sudo systemctl status scout-app scout-update.timer
sudo journalctl -u scout-app -u scout-update -n 100 --no-pager
sudo journalctl -u scout-update -f

# Check GitHub immediately
sudo systemctl start scout-update

# Pause automatic updates (the app stays running)
sudo systemctl disable --now scout-update.timer
# Resume
sudo systemctl enable --now scout-update.timer
```

Settings are in `/etc/scout-app.env`. For branch/port changes, rerun the installer
with the desired variables so the web service and updater agree. Rerun the
installer after changing your Node installation path or updating service setup.

## Data and access

Live data is at `~/.local/share/scout-app/db.json` for the installation user,
outside Git and all build directories. The installer copies the existing
database only if the destination does not exist. Back up that file regularly.
Database writes use a synced temporary file and atomic rename. The first persisted
schema upgrade preserves a `.pre-upgrade-v1.bak` backup. Session token hashes and
push credentials live in private files beside the database, never in Git.

The API enforces authenticated membership and server-side permissions. Use HTTPS,
keep backups, protect the host and prefer Tailscale SSH for remote administration.
No public terminal is embedded. After upgrading, review permanent ownership and
publication settings before relying on generated duties or sharing measurements.

Releases are retained under `~/.local/share/scout-app/releases` for recovery.
Monitor disk usage and remove old releases only after checking that they are
neither the `current` symlink target nor your desired rollback release.

## Local development

```bash
cd Clasue-scout-app
npm ci
npm run dev
# API requests from Vite are proxied to port 3001.
npm run build
npm test
npm run lint:active
```

`npm start` serves the built app. Use `DB_FILE=/absolute/path/db.json` to choose
the data location and `APP_PORT=3001` to choose the server port.

Release numbers follow the [versioning guide](docs/argus-2/versioning.md). The current version is stored in `Clasue-scout-app/package.json`.
