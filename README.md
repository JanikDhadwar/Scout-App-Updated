# Argus — FRC Team 6390 Scouting App

**Argus** is the scouting workspace for FRC Team 6390 (Hephaustus), live at [6390scout.app](https://6390scout.app). It replaces paper scouting sheets with a phone-friendly app that works offline at competitions.

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

- React 19 + Vite frontend, installed as a PWA — offline support via service worker and IndexedDB
- Express server (`server.cjs`) on port 3001 with a JSON-file database (`db.json`) — no external database needed
- Live competition data from The Blue Alliance API

## Demo login

Try it on the login page — user `Example`, password `123`.

---
# Argus — Debian self-hosting

The active app is `Clasue-scout-app/src/frc-scout-local.jsx`, served by
`server.cjs` on port **3001**. It saves scouting data to a JSON file on your
server. The Firebase component is not used.

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

## What happens after a push

`scout-update.timer` checks the configured branch every minute (and shortly
after reboot). New commits trigger a fast-forward pull, `npm ci`, a production
build, and a restart of `scout-app.service`. Multiple pushes between checks
deploy the latest commit. No public GitHub webhook endpoint is needed.

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
Database writes use a temporary file and rename to avoid partially written JSON.
Login sessions are now per browser; existing users will need to log in again.

This existing app implements login and roles in the browser, and its data API
does not enforce authentication. Keep it on your trusted LAN/Tailscale or behind
an authenticated proxy; it is not ready for unrestricted public access.

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
```

`npm start` serves the built app. Use `DB_FILE=/absolute/path/db.json` to choose
the data location and `APP_PORT=3001` to choose the server port.
