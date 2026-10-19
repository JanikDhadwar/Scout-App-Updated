#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
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
revision=''
release=''
stage=starting
report() {
  local checkout
  checkout=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || true)
  if [[ -f "$REPO_DIR/scripts/deploy-status.cjs" ]]; then
    node "$REPO_DIR/scripts/deploy-status.cjs" "$SCOUT_STATE_DIR" "$stage" "$1" "$revision" "$checkout" "$release" "${2:-0}" || true
  fi
}
on_error() {
  local code=$1
  trap - ERR
  report failed "$code"
  exit "$code"
}
trap 'on_error "$?"' ERR
# Detailed output stays private; only fixed stages and commit hashes are published.
touch "$SCOUT_STATE_DIR/deploy-latest.log"
chmod 600 "$SCOUT_STATE_DIR/deploy-latest.log"
exec > >(tee -a "$SCOUT_STATE_DIR/deploy-latest.log") 2>&1
report running
stage=fetch
report running
git fetch --prune origin "+refs/heads/$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
revision=$(git rev-parse "refs/remotes/origin/$DEPLOY_BRANCH")
report succeeded
previous=$(readlink -f "$SCOUT_STATE_DIR/current" || true)
if [[ -f "$SCOUT_STATE_DIR/deployed-revision" ]] && [[ $(cat "$SCOUT_STATE_DIR/deployed-revision") == "$revision" ]] && [[ "${1:-}" != --force ]]; then
  stage=idle
  report current
  exit 0
fi
# Never force-reset the checkout: it may contain live data or server edits.
stage=merge
report running
[[ $(git branch --show-current) == "$DEPLOY_BRANCH" ]] || { echo "Checkout must be on $DEPLOY_BRANCH" >&2; report failed 1; exit 1; }
git merge --ff-only "refs/remotes/origin/$DEPLOY_BRANCH"
[[ $(git rev-parse HEAD) == "$revision" ]] || { echo 'Local commits differ from origin; resolve before deploying.' >&2; report failed 1; exit 1; }
report succeeded
stage=archive
report running
release=$(mktemp -d "$SCOUT_STATE_DIR/releases/$revision.XXXXXX")
echo "Building $revision in $release"
git archive "$revision" Clasue-scout-app | tar -x -C "$release"
cd "$release/Clasue-scout-app"
stage=install
report running
npm ci --include=dev --no-audit --no-fund
stage=build
report running
npm run build
stage=validate
report running
node --check server.cjs
activate() {
  ln -sfn "$1" "$SCOUT_STATE_DIR/current.next"
  mv -Tf "$SCOUT_STATE_DIR/current.next" "$SCOUT_STATE_DIR/current"
}
healthy() {
  stage=health
  report running
  for attempt in {1..30}; do
    if curl --max-time 2 -fsS "http://127.0.0.1:$APP_PORT/api/health" | grep -Fq "\"release\":\"$(basename "$release")\""; then return 0; fi
    sleep 1
  done
  return 1
}
activate "$release"
stage=restart
report running
if sudo -n /usr/bin/systemctl restart scout-app.service && healthy; then
  printf '%s\n' "$revision" > "$SCOUT_STATE_DIR/deployed-revision"
  stage=complete
  report succeeded
  echo "Deployed $revision successfully."
else
  failed_stage=$stage
  stage=rollback
  report running
  echo 'New release failed; restoring previous release.' >&2
  if [[ -n "$previous" && -d "$previous" ]]; then
    activate "$previous"
    sudo -n /usr/bin/systemctl restart scout-app.service
  fi
  stage=$failed_stage
  report failed 1
  exit 1
fi
}
main "$@"
