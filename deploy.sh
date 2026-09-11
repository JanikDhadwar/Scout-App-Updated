#!/usr/bin/env bash
set -Eeuo pipefail
# Parse the full deployment before Git updates this script on disk.
main() {
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ ! -f /etc/scout-app.env ]] || source /etc/scout-app.env
: "${SCOUT_STATE_DIR:=$HOME/.local/share/scout-app}"
: "${DEPLOY_BRANCH:=main}"
: "${APP_PORT:=3001}"
export GIT_TERMINAL_PROMPT=0
mkdir -p "$SCOUT_STATE_DIR/releases"
exec 9>"$SCOUT_STATE_DIR/deploy.lock"
flock -n 9 || exit 0
cd "$REPO_DIR"
git fetch --prune origin "+refs/heads/$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
revision=$(git rev-parse "refs/remotes/origin/$DEPLOY_BRANCH")
previous=$(readlink -f "$SCOUT_STATE_DIR/current" || true)
if [[ -f "$SCOUT_STATE_DIR/deployed-revision" ]] && [[ $(cat "$SCOUT_STATE_DIR/deployed-revision") == "$revision" ]] && [[ "${1:-}" != --force ]]; then
  exit 0
fi
# Never force-reset the checkout: it may contain live data or server edits.
[[ $(git branch --show-current) == "$DEPLOY_BRANCH" ]] || { echo "Checkout must be on $DEPLOY_BRANCH" >&2; exit 1; }
git merge --ff-only "refs/remotes/origin/$DEPLOY_BRANCH"
[[ $(git rev-parse HEAD) == "$revision" ]] || { echo 'Local commits differ from origin; resolve before deploying.' >&2; exit 1; }
release=$(mktemp -d "$SCOUT_STATE_DIR/releases/$revision.XXXXXX")
echo "Building $revision in $release"
git archive "$revision" Clasue-scout-app | tar -x -C "$release"
cd "$release/Clasue-scout-app"
npm ci --include=dev --no-audit --no-fund
npm run build
node --check server.cjs
activate() {
  ln -sfn "$1" "$SCOUT_STATE_DIR/current.next"
  mv -Tf "$SCOUT_STATE_DIR/current.next" "$SCOUT_STATE_DIR/current"
}
healthy() {
  for attempt in {1..30}; do
    if curl --max-time 2 -fsS "http://127.0.0.1:$APP_PORT/api/health" | grep -Fq "\"release\":\"$(basename "$release")\""; then return 0; fi
    sleep 1
  done
  return 1
}
activate "$release"
if sudo -n /usr/bin/systemctl restart scout-app.service && healthy; then
  printf '%s\n' "$revision" > "$SCOUT_STATE_DIR/deployed-revision"
  echo "Deployed $revision successfully."
else
  echo 'New release failed; restoring previous release.' >&2
  if [[ -n "$previous" && -d "$previous" ]]; then
    activate "$previous"
    sudo -n /usr/bin/systemctl restart scout-app.service
  fi
  exit 1
fi
}
main "$@"
