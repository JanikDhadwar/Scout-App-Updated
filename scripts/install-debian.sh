#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID != 0 ]] || { echo 'Run as the normal user who owns the checkout, without sudo.' >&2; exit 1; }
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_USER=$(id -un)
SCOUT_STATE_DIR="$HOME/.local/share/scout-app"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
APP_PORT="${APP_PORT:-3001}"
for command in git node npm curl flock sudo; do command -v "$command" >/dev/null || { echo "Install $command first." >&2; exit 1; }; done
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<12)) process.exit(1)' || { echo 'Install Node.js 22.12+ (Node 24 LTS recommended).'; exit 1; }
[[ "$REPO_DIR" != *[[:space:]]* && "$SCOUT_STATE_DIR" != *[[:space:]]* ]] || { echo 'Use a checkout and home path without spaces.'; exit 1; }
[[ "$APP_PORT" =~ ^[0-9]+$ ]] && ((APP_PORT > 0 && APP_PORT < 65536)) || { echo 'Invalid APP_PORT'; exit 1; }
git check-ref-format --branch "$DEPLOY_BRANCH" >/dev/null
mkdir -p "$SCOUT_STATE_DIR"
chmod 700 "$SCOUT_STATE_DIR"
# Copy the old database once; reinstalling never replaces live data.
if [[ ! -f "$SCOUT_STATE_DIR/db.json" && -f "$REPO_DIR/Clasue-scout-app/db.json" ]]; then
  cp "$REPO_DIR/Clasue-scout-app/db.json" "$SCOUT_STATE_DIR/db.json"
  chmod 600 "$SCOUT_STATE_DIR/db.json"
fi
NODE_BIN=$(command -v node)
RUNTIME_PATH="$(dirname "$NODE_BIN"):$(dirname "$(command -v npm)"):/usr/local/bin:/usr/bin:/bin"
sudo -v
printf 'SCOUT_STATE_DIR=%q\nDEPLOY_BRANCH=%q\nAPP_PORT=%q\n' "$SCOUT_STATE_DIR" "$DEPLOY_BRANCH" "$APP_PORT" | sudo tee /etc/scout-app.env >/dev/null
sudo tee /etc/systemd/system/scout-app.service >/dev/null <<EOF
[Unit]
Description=FRC Scout local web app
After=network.target
[Service]
User=$DEPLOY_USER
WorkingDirectory=$SCOUT_STATE_DIR/current/Clasue-scout-app
Environment=NODE_ENV=production
Environment=APP_PORT=$APP_PORT
Environment=DB_FILE=$SCOUT_STATE_DIR/db.json
ExecStart=$NODE_BIN $SCOUT_STATE_DIR/current/Clasue-scout-app/server.cjs
Restart=on-failure
RestartSec=5
UMask=0077
[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/systemd/system/scout-update.service >/dev/null <<EOF
[Unit]
Description=Fetch, build and deploy FRC Scout updates
Wants=network-online.target
After=network-online.target
[Service]
Type=oneshot
User=$DEPLOY_USER
Environment="PATH=$RUNTIME_PATH"
WorkingDirectory=$REPO_DIR
ExecStart=/bin/bash $REPO_DIR/deploy.sh
TimeoutStartSec=15min
UMask=0077
EOF
sudo tee /etc/systemd/system/scout-update.timer >/dev/null <<'EOF'
[Unit]
Description=Check GitHub for FRC Scout updates every minute
[Timer]
OnBootSec=30s
OnUnitInactiveSec=60s
AccuracySec=5s
Unit=scout-update.service
[Install]
WantedBy=timers.target
EOF
sudoers_file=$(mktemp)
trap 'rm -f "$sudoers_file"' EXIT
printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart scout-app.service\n' "$DEPLOY_USER" > "$sudoers_file"
sudo visudo -cf "$sudoers_file"
sudo install -m 0440 "$sudoers_file" /etc/sudoers.d/scout-app
sudo systemctl daemon-reload
bash "$REPO_DIR/deploy.sh" --force
sudo systemctl enable scout-app.service
sudo systemctl enable --now scout-update.timer
echo "Ready: http://<server-ip>:$APP_PORT — GitHub checked every minute."
