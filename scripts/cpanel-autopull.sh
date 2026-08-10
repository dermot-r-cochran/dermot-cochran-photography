#!/bin/bash
#
# scripts/cpanel-autopull.sh
#
# Cron entry point for a cPanel Git Version Control clone: fast-forward this
# checkout from its remote and, only when that actually moves the commit this
# clone has successfully deployed, run the full deployment
# (scripts/cpanel-deploy.sh).
#
# WHY THIS EXISTS: nothing connects a merge on GitHub to a production domain.
# cPanel does not poll GitHub, and GitHub cannot push into cPanel - so a
# merge to the deploy branch updates every clone's *remote* and none of their
# *checkouts* until something on the server pulls. This script is that
# something, run from cron.
#
# (Setting the cPanel repositories up as GitHub forks would not have helped.
# A fork does not auto-sync from upstream either - "Sync fork" is a manual
# button, or a scripted `gh repo sync` - and a cPanel clone pulls from
# whatever URL it was given without subscribing to anything at either end.
# Forking would have added a hop, each needing its own trigger, not removed
# one.)
#
# SHARED FILE - this exact file lives in BOTH the star-rangers and
# dermot-cochran-photography repositories and must stay byte-identical
# between them (same convention as scripts/deploy-lib.sh and
# scripts/ensure-node.sh, which already are). If you change it in one repo,
# port the identical change to the other and keep the two files diff-clean -
# `diff` against the sibling repo's copy before committing.
#
# Shell: bash. Unlike ensure-node.sh (which is *sourced* and so must work
# under any caller shell), this script is executed with its own interpreter
# from a crontab line that names bash explicitly, so bash-only features are
# free here.
#
# INSTALL: one crontab line per clone, per cPanel account. See the repo
# README's "Automatic deployment from cron" section for the walkthrough,
# including which account each domain lives on.
#
#   */10 * * * * /bin/bash "$HOME/repositories/<checkout-dir>/scripts/cpanel-autopull.sh"
#
# ...where <checkout-dir> is the clone's own directory under ~/repositories/
# (this project's cPanel accounts keep their Git Version Control checkouts
# there). Confirm it against the Repository Path cPanel shows for that clone -
# it is not always the repo name, and one account can hold clones of both
# repos at once, each needing its own crontab line.
#
# USAGE
#   cpanel-autopull.sh [--force] [--verbose] [--status] [--help]
#
#     --force    Deploy even if the remote brought nothing new. Use after
#                changing deploy.conf, which is untracked and so never moves
#                HEAD, but does change what gets built.
#     --verbose  Narrate every decision. Without it the script is SILENT
#                unless it deploys or fails, because cron mails any output
#                and a job this frequent must not mail on every run.
#     --status   Print what the script knows and exit, changing nothing.
#
# EXIT CODES
#   0  nothing to do, or deployed successfully
#   1  usage error, or the environment is unusable (no git, not a checkout)
#   2  another run holds the lock (not an error; a long deploy is running)
#   3  the pull failed (diverged history, dirty tree, network)
#   N  the deploy failed - scripts/cpanel-deploy.sh's own exit code, which
#      has already emailed its log to ADMIN_EMAIL and written it to
#      deploy-logs/, so this script deliberately adds no commentary
#
# WHY LAST-DEPLOYED IS TRACKED SEPARATELY FROM HEAD: comparing HEAD before
# and after the pull looks like the obvious test, and is wrong. If a pull
# succeeds and the deploy that follows it fails, HEAD is already advanced -
# so the next run sees "nothing new", skips the deploy, and the failure is
# never retried. The site would then sit stale behind a green-looking cron
# job indefinitely. This script instead records the commit it last deployed
# *successfully*, and compares against that, so a failed deploy is retried
# on the next run and every run after it until it succeeds.

set -u -o pipefail

# ---------------------------------------------------------------------------
# cron's PATH is minimal and frequently lacks git. Add the usual cPanel and
# system locations before giving up, so the crontab line doesn't have to
# carry a PATH= of its own.
# ---------------------------------------------------------------------------
PATH="$PATH:/usr/local/cpanel/3rdparty/bin:/usr/local/bin:/usr/bin:/bin"
export PATH

FORCE=false
VERBOSE=false
STATUS_ONLY=false

usage() {
  sed -n '/^# USAGE/,/^# WHY LAST-DEPLOYED/p' "$0" | sed 's/^# \{0,1\}//; $d'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)   FORCE=true ;;
    --verbose) VERBOSE=true ;;
    --status)  STATUS_ONLY=true ;;
    --help|-h) usage; exit 0 ;;
    *)
      printf 'cpanel-autopull: unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Output helpers. say() is suppressed unless --verbose; announce() and err()
# always print, because they mark the two states cron SHOULD mail about.
# ---------------------------------------------------------------------------
say() { if [[ "$VERBOSE" == true ]]; then printf '%s\n' "$*"; fi; }
announce() { printf '%s\n' "$*"; }
err() { printf 'cpanel-autopull: %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# Locate the checkout from this script's own location, not from cwd - cron
# runs jobs from $HOME regardless of where the script lives.
# ---------------------------------------------------------------------------
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || {
  err "cannot resolve own directory"
  exit 1
}
REPOSITORY_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd) || {
  err "cannot resolve repository root"
  exit 1
}

command -v git >/dev/null 2>&1 || {
  err "git not found on PATH ($PATH)"
  exit 1
}

cd "$REPOSITORY_ROOT" || {
  err "cannot cd to $REPOSITORY_ROOT"
  exit 1
}

git rev-parse --git-dir >/dev/null 2>&1 || {
  err "$REPOSITORY_ROOT is not a git checkout"
  exit 1
}

DEPLOY_SCRIPT="$REPOSITORY_ROOT/scripts/cpanel-deploy.sh"
[[ -f "$DEPLOY_SCRIPT" ]] || {
  err "missing $DEPLOY_SCRIPT"
  exit 1
}

# ---------------------------------------------------------------------------
# Per-clone state, kept under $HOME rather than in the checkout: it must
# survive `git clean`, it is machine-specific and must never be committed,
# and keeping it out of the tree means no .gitignore entry is needed in
# either repo. Keyed by checkout basename plus a checksum of the absolute
# path, so two clones of the same repo on one account cannot collide.
# ---------------------------------------------------------------------------
PATH_SUM=$(printf '%s' "$REPOSITORY_ROOT" | cksum | cut -d' ' -f1)
SLUG="$(basename "$REPOSITORY_ROOT")-$PATH_SUM"
STATE_DIR="${HOME:-/tmp}/.cpanel-autopull"
STATE_FILE="$STATE_DIR/$SLUG.state"
LOG_FILE="$STATE_DIR/$SLUG.log"
LOCK_DIR="$STATE_DIR/$SLUG.lock"

mkdir -p "$STATE_DIR" || {
  err "cannot create $STATE_DIR"
  exit 1
}

# ---------------------------------------------------------------------------
# Append to this script's own small log - distinct from the deploy's logs,
# which scripts/deploy-lib.sh already persists under deploy-logs/ and mails
# to ADMIN_EMAIL. This one records only the pull/skip/deploy decisions, so
# "why did the site not update" is answerable without a mailbox. Pruned to
# the last 500 lines on every run so it cannot grow without bound.
# ---------------------------------------------------------------------------
log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  printf '%s  %s\n' "$ts" "$*" >>"$LOG_FILE" 2>/dev/null || true
}

prune_log() {
  local tmp
  [[ -f "$LOG_FILE" ]] || return 0
  tmp=$(mktemp "$STATE_DIR/log.XXXXXX" 2>/dev/null) || return 0
  if tail -n 500 "$LOG_FILE" >"$tmp" 2>/dev/null; then
    mv -f "$tmp" "$LOG_FILE" 2>/dev/null || rm -f "$tmp"
  else
    rm -f "$tmp"
  fi
}

read_state() {
  if [[ -r "$STATE_FILE" ]]; then
    head -n 1 "$STATE_FILE" 2>/dev/null | tr -d '[:space:]'
  fi
}

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown)
LAST_DEPLOYED=$(read_state)

if [[ "$STATUS_ONLY" == true ]]; then
  printf 'checkout:      %s\n' "$REPOSITORY_ROOT"
  printf 'branch:        %s\n' "$CURRENT_BRANCH"
  printf 'HEAD:          %s\n' "$HEAD_SHA"
  printf 'last deployed: %s\n' "${LAST_DEPLOYED:-(none recorded)}"
  printf 'state file:    %s\n' "$STATE_FILE"
  printf 'log file:      %s\n' "$LOG_FILE"
  if [[ -d "$LOCK_DIR" ]]; then
    printf 'lock:          HELD (pid %s)\n' "$(cat "$LOCK_DIR/pid" 2>/dev/null || echo '?')"
  else
    printf 'lock:          free\n'
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Lock. A full deploy (npm ci + one Eleventy build per domain) can outlast
# the cron interval, and two concurrent deploys rsyncing the same document
# root would interleave. mkdir is the atomic primitive available everywhere;
# flock is not guaranteed present on cPanel hosts.
#
# A lock whose recorded pid is gone is stale - from a run killed mid-flight,
# or a server reboot - and is reclaimed rather than blocking forever.
# ---------------------------------------------------------------------------
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  lock_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo '')
  if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
    say "another run (pid $lock_pid) holds the lock; exiting"
    log "SKIP  lock held by pid $lock_pid"
    exit 2
  fi
  err "clearing stale lock (pid ${lock_pid:-unknown} is gone)"
  log "LOCK  cleared stale lock (pid ${lock_pid:-unknown})"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null || {
    err "cannot acquire lock at $LOCK_DIR"
    exit 1
  }
fi
printf '%s\n' "$$" >"$LOCK_DIR/pid" 2>/dev/null || true

cleanup() {
  rm -rf "$LOCK_DIR"
  prune_log
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Pull. --ff-only deliberately: this checkout is a deployment target, never a
# place work is done, so anything that cannot fast-forward is a fault to
# report rather than a merge to resolve. A dirty tracked file is the usual
# cause (deploy.conf and the other per-clone files are untracked and
# gitignored, so they never interfere).
# ---------------------------------------------------------------------------
if [[ "$CURRENT_BRANCH" == HEAD ]]; then
  err "detached HEAD in $REPOSITORY_ROOT - check the clone out on a branch"
  log "FAIL  detached HEAD"
  exit 3
fi

say "pulling $CURRENT_BRANCH in $REPOSITORY_ROOT"
if ! pull_output=$(git pull --ff-only 2>&1); then
  err "git pull --ff-only failed on branch $CURRENT_BRANCH:"
  printf '%s\n' "$pull_output" >&2
  log "FAIL  pull: $(printf '%s' "$pull_output" | tr '\n' ' ')"
  exit 3
fi
say "$pull_output"

HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown)

# ---------------------------------------------------------------------------
# Decide. Three reasons to deploy: --force, no recorded successful deploy
# (first run after install), or HEAD no longer matches what was last
# deployed - which covers both "the pull brought something new" and "the
# last deploy failed after its pull had already advanced HEAD".
# ---------------------------------------------------------------------------
if [[ "$FORCE" == true ]]; then
  reason="forced"
elif [[ -z "$LAST_DEPLOYED" ]]; then
  reason="no previous successful deploy recorded"
elif [[ "$LAST_DEPLOYED" != "$HEAD_SHA" ]]; then
  reason="HEAD $(git rev-parse --short HEAD) differs from last deployed ${LAST_DEPLOYED:0:7}"
else
  say "already deployed $HEAD_SHA; nothing to do"
  log "SKIP  up to date at $HEAD_SHA"
  exit 0
fi

announce "cpanel-autopull: deploying $REPOSITORY_ROOT ($reason)"
log "DEPLOY start $HEAD_SHA ($reason)"

# ---------------------------------------------------------------------------
# Hand off. cpanel-deploy.sh expects cwd to be the checkout root - that is
# what cPanel's own task runner gives it, and .cpanel.yml relies on it - so
# it is not given a path argument here either. Its stdout/stderr flow
# straight through to cron's mail, on top of the log it mails itself.
# ---------------------------------------------------------------------------
bash "$DEPLOY_SCRIPT"
deploy_status=$?

if [[ "$deploy_status" -eq 0 ]]; then
  printf '%s\n' "$HEAD_SHA" >"$STATE_FILE" 2>/dev/null \
    || err "deployed $HEAD_SHA but could not write $STATE_FILE - the next run will redeploy"
  announce "cpanel-autopull: deployed $HEAD_SHA"
  log "DEPLOY ok $HEAD_SHA"
else
  # Deliberately no extra diagnosis: cpanel-deploy.sh has already emailed
  # its full log and written it to deploy-logs/. The state file is left
  # untouched, so the next run retries this same commit.
  err "deploy failed with status $deploy_status (see deploy-logs/ and the ADMIN_EMAIL log)"
  log "DEPLOY FAIL $HEAD_SHA status=$deploy_status"
fi

exit "$deploy_status"
