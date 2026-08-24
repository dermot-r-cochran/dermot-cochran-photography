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
# between them (same convention as scripts/deploy-lib.sh,
# scripts/mail-lib.sh and scripts/ensure-node.sh, which already are). If you
# change it in one repo, port the identical change to the other and keep the
# two files diff-clean - `diff` against the sibling repo's copy before
# committing. Nothing here may name one repo's files: this comment block
# once said "README" in one copy and "TECHNICAL-README.md" in the other,
# which is exactly how the two drift apart.
#
# Shell: bash. Unlike ensure-node.sh (which is *sourced* and so must work
# under any caller shell), this script is executed with its own interpreter
# from a crontab line that names bash explicitly, so bash-only features are
# free here.
#
# INSTALL: one crontab line per clone, per cPanel account. See the repo's
# deployment README ("Automatic deployment from cron") for the walkthrough,
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
# $HOME is deliberate over a hardcoded /home/<user>/: cron sets HOME from the
# account's passwd entry and runs the command through sh, so it expands, and
# the same line then goes into every account's crontab with nothing to
# hand-edit. Keep the double quotes - single quotes would stop the expansion.
#
# DO NOT prefix the crontab line with a pull:
#
#   # WRONG
#   cd ~/repositories/<checkout-dir> && git pull --ff-only && bash ...
#
# That bare pull runs OUTSIDE the lock below. A full deploy routinely outlasts
# a ten-minute interval, so runs overlap; when they do, an unlocked pull
# advances HEAD while a build is already reading the tree and the build ships
# a mixture of two commits - the precise fault the lock exists to prevent.
# This script does its own pull inside the lock. The `cd` is redundant too
# (the checkout is resolved from this script's own location, below), and the
# && chain would swallow this script's exit codes, turning a transient network
# failure into raw git noise with the script never running at all.
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
# NOTIFICATIONS
#   Silence used to be ambiguous. A run that did nothing and a run that
#   FAILED looked identical from a mailbox, because err() writes to stderr
#   and cron mails stderr to the account's own system mailbox - which is not
#   where anyone reads mail. Meanwhile every deploy outcome, success or
#   failure, was already being mailed to ADMIN_EMAIL by cpanel-deploy.sh.
#   The blind spot was exactly the window before the handoff: this script.
#
#   So a run that fires and fails now also mails ADMIN_EMAIL directly, via
#   scripts/mail-lib.sh. Silence goes back to meaning one thing only:
#   nothing needed doing.
#
#     mailed      exit 1 (environment unusable) and exit 3 (pull failed)
#     NOT mailed  exit 0 - correct silence, and the whole point
#                 exit 2 - a lock held by a long deploy is normal, not a
#                          fault; mailing it would train the alert to be
#                          ignored, which is the failure mode this exists
#                          to prevent
#                 deploy failures - cpanel-deploy.sh already mails those in
#                          full, and a second mail would only double up on
#                          the one path that was never broken
#
#   Address: ADMIN_EMAIL from deploy.conf, else admin@$DOMAIN, matching how
#   cpanel-deploy.sh resolves it. With neither set there is nothing to mail
#   to, and the script falls back to stderr exactly as it always behaved -
#   no send is ever allowed to change an exit code.
#
#   AUTOPULL_MAX_GAP_HOURS (optional, deploy.conf): if this run finds the
#   previous one longer ago than that, mail a "runs were missed" alert.
#   DEFAULTS TO 30 (hours) since 15 August 2026 - suited to a daily cron with
#   six hours of slack. Override in deploy.conf for a different interval, or
#   set 0 for no alerting at all. It previously defaulted to unset, on the
#   reasoning that the interval lives in cPanel and the repo must not guess;
#   that produced weeks of undetectable silence on one domain, which is the
#   worse failure. Note the limit either way: it can only report missed runs
#   on the next run that DOES happen. A cron that never fires again cannot
#   report anything, and no code here can change that.
#
# EXIT CODES
#   0  nothing to do, or deployed successfully
#   1  usage error, or the environment is unusable (no git, not a checkout)
#      - mailed, except for the two failures that happen before this script
#        has resolved its own checkout and so cannot read deploy.conf
#   2  another run holds the lock (not an error; a long deploy is running)
#   3  the pull failed (diverged history, dirty tree, network) - mailed
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
# These two are the only failures that cannot be mailed: until the checkout
# is located there is no deploy.conf to read an address out of. They stay
# stderr-only, which is what every failure here used to be.
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || {
  err "cannot resolve own directory"
  exit 1
}
REPOSITORY_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd) || {
  err "cannot resolve repository root"
  exit 1
}

# ---------------------------------------------------------------------------
# Mail transport, for this script's OWN failures - see NOTIFICATIONS above.
# Sourced, never reimplemented: scripts/mail-lib.sh is side-effect-free on
# source precisely so it can be pulled in on every run of a cron job,
# including the common one that finds nothing and exits immediately.
#
# A missing mail-lib is NOT fatal here, unlike in deploy-lib.sh. This script
# exists to get merges onto the site; losing the ability to complain must
# not also lose the ability to deploy. It degrades to stderr and says so.
# ---------------------------------------------------------------------------
MAIL_LIB="$REPOSITORY_ROOT/scripts/mail-lib.sh"
MAIL_LIB_OK=false
if [[ -f "$MAIL_LIB" ]]; then
  # shellcheck source=scripts/mail-lib.sh
  if . "$MAIL_LIB" 2>/dev/null; then
    MAIL_LIB_OK=true
  else
    err "could not source $MAIL_LIB - failures will go to stderr only"
  fi
else
  err "missing $MAIL_LIB - failures will go to stderr only"
fi

# ---------------------------------------------------------------------------
# deploy.conf, read in a SUBSHELL so none of its keys can land in this
# script's namespace. It is an arbitrary shell file written per clone, and
# this script has a `cd`, a lock and an exit status to protect; sourcing it
# inline would put every key it happens to define one name collision away
# from those. Only the three values below cross back, as text.
#
# Address resolution matches cpanel-deploy.sh: explicit ADMIN_EMAIL wins,
# else admin@<DOMAIN>. Both unset means no address exists to mail to, which
# is a supported state, not an error.
# ---------------------------------------------------------------------------
read_deploy_conf() {
  (
    ADMIN_EMAIL=""
    DOMAIN=""
    CPANEL_USER=""
    AUTOPULL_MAX_GAP_HOURS=""
    # shellcheck disable=SC1091
    [[ -f "$REPOSITORY_ROOT/deploy.conf" ]] && . "$REPOSITORY_ROOT/deploy.conf"
    addr="${ADMIN_EMAIL:-}"
    if [[ -z "$addr" && -n "${DOMAIN:-}" ]]; then
      addr="admin@${DOMAIN}"
    fi
    printf 'addr=%s\n' "$addr"
    printf 'user=%s\n' "${CPANEL_USER:-}"
    printf 'gap=%s\n' "${AUTOPULL_MAX_GAP_HOURS:-}"
  ) 2>/dev/null
}

DEPLOY_CONF_VALUES=$(read_deploy_conf)
NOTIFY_ADDR=$(printf '%s\n' "$DEPLOY_CONF_VALUES" | sed -n 's/^addr=//p')
CONF_USER=$(printf '%s\n' "$DEPLOY_CONF_VALUES" | sed -n 's/^user=//p')
MAX_GAP_HOURS=$(printf '%s\n' "$DEPLOY_CONF_VALUES" | sed -n 's/^gap=//p')
[[ -n "$CONF_USER" ]] || CONF_USER="${USER:-$(id -un 2>/dev/null || echo unknown)}"

# ---------------------------------------------------------------------------
# Per-clone state, kept under $HOME rather than in the checkout: it must
# survive `git clean`, it is machine-specific and must never be committed,
# and keeping it out of the tree means no .gitignore entry is needed in
# either repo. Keyed by checkout basename plus a checksum of the absolute
# path, so two clones of the same repo on one account cannot collide.
#
# These are pure string operations and cannot fail, so they are computed
# before anything that can - which is what lets log() and the mailer be
# available to EVERY failure below, including "git not found". Until this
# moved up, the earliest failures were neither logged nor mailed.
# ---------------------------------------------------------------------------
PATH_SUM=$(printf '%s' "$REPOSITORY_ROOT" | cksum | cut -d' ' -f1)
SLUG="$(basename "$REPOSITORY_ROOT")-$PATH_SUM"
STATE_DIR="${HOME:-/tmp}/.cpanel-autopull"
STATE_FILE="$STATE_DIR/$SLUG.state"
LOG_FILE="$STATE_DIR/$SLUG.log"
LOCK_DIR="$STATE_DIR/$SLUG.lock"
LASTRUN_FILE="$STATE_DIR/$SLUG.lastrun"

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

# LASTRUN records that the cron FIRED, which is a different question from
# what it deployed - a run that finds nothing new is still proof the job is
# alive, and that is exactly the fact no artifact recorded before. Stored as
# a bare epoch; `tr -cd` because a hand-edited or truncated file must not
# turn into an arithmetic error below.
read_lastrun() {
  if [[ -r "$LASTRUN_FILE" ]]; then
    head -n 1 "$LASTRUN_FILE" 2>/dev/null | tr -cd '0-9'
  fi
}

# Seconds -> "3h 12m", for humans reading --status.
format_age() {
  local secs="$1"
  if [[ "$secs" -lt 60 ]]; then
    printf '%ds' "$secs"
  elif [[ "$secs" -lt 3600 ]]; then
    printf '%dm' "$((secs / 60))"
  else
    printf '%dh %dm' "$((secs / 3600))" "$(((secs % 3600) / 60))"
  fi
}

# ---------------------------------------------------------------------------
# Alerting. fail() is the single exit path for every fault this script can
# name: report to stderr (so cron behaves exactly as it always has), record
# the decision, mail ADMIN_EMAIL, and exit with the given status.
#
# The mailer's own chatter is captured into the decision log rather than
# printed, so cron keeps mailing the failure itself rather than a commentary
# about delivery. And nothing here may alter the exit status - a failure
# that could not be emailed is still that failure, with its own code.
# ---------------------------------------------------------------------------
repo_name() {
  local url
  url=$(git -C "$REPOSITORY_ROOT" config --get remote.origin.url 2>/dev/null) || url=""
  if [[ -n "$url" ]]; then
    basename "${url%.git}"
  else
    basename "$REPOSITORY_ROOT"
  fi
}

send_alert() {
  local tag="$1" summary="$2" subject body short

  [[ "$MAIL_LIB_OK" == true ]] || return 0
  if [[ -z "$NOTIFY_ADDR" ]]; then
    log "MAIL  skipped ($tag): no ADMIN_EMAIL or DOMAIN in deploy.conf"
    return 0
  fi

  short=$(git -C "$REPOSITORY_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
  subject="[$(repo_name) autopull] $tag - $CONF_USER - $short - $(date -u +'%Y-%m-%d %H:%M:%SZ')"

  body=$(mktemp "${TMPDIR:-/tmp}/autopull-alert.XXXXXX" 2>/dev/null) || {
    log "MAIL  skipped ($tag): could not create a temp file for the body"
    return 0
  }

  {
    printf '%s\n\n' "$summary"
    printf 'checkout:      %s\n' "$REPOSITORY_ROOT"
    printf 'branch:        %s\n' "${CURRENT_BRANCH:-unknown}"
    printf 'HEAD:          %s\n' "${HEAD_SHA:-unknown}"
    printf 'last deployed: %s\n' "${LAST_DEPLOYED:-(none recorded)}"
    printf 'host:          %s\n' "$(uname -n 2>/dev/null || echo unknown)"
    printf '\n--- recent decisions (%s) ---\n' "$LOG_FILE"
    tail -n 30 "$LOG_FILE" 2>/dev/null || printf '(no log available)\n'
  } >"$body" 2>/dev/null

  if mail_lib_send "$subject" "$body" "$NOTIFY_ADDR" >>"$LOG_FILE" 2>&1; then
    log "MAIL  sent ($tag) to $NOTIFY_ADDR"
  else
    err "could not email $NOTIFY_ADDR about: $summary"
    log "MAIL  FAILED ($tag) to $NOTIFY_ADDR"
  fi

  rm -f "$body" 2>/dev/null
  return 0
}

fail() {
  local status="$1" summary="$2"
  err "$summary"
  log "FAIL  $summary"
  send_alert FAILURE "autopull failed (exit $status): $summary"
  exit "$status"
}

mkdir -p "$STATE_DIR" || fail 1 "cannot create $STATE_DIR"

command -v git >/dev/null 2>&1 || fail 1 "git not found on PATH ($PATH)"

cd "$REPOSITORY_ROOT" || fail 1 "cannot cd to $REPOSITORY_ROOT"

git rev-parse --git-dir >/dev/null 2>&1 \
  || fail 1 "$REPOSITORY_ROOT is not a git checkout"

DEPLOY_SCRIPT="$REPOSITORY_ROOT/scripts/cpanel-deploy.sh"
[[ -f "$DEPLOY_SCRIPT" ]] || fail 1 "missing $DEPLOY_SCRIPT"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown)
LAST_DEPLOYED=$(read_state)
PREV_RUN=$(read_lastrun)
NOW_EPOCH=$(date +%s 2>/dev/null || echo 0)

if [[ "$STATUS_ONLY" == true ]]; then
  printf 'checkout:      %s\n' "$REPOSITORY_ROOT"
  printf 'branch:        %s\n' "$CURRENT_BRANCH"
  printf 'HEAD:          %s\n' "$HEAD_SHA"
  printf 'last deployed: %s\n' "${LAST_DEPLOYED:-(none recorded)}"
  # "last ran" answers a question "last deployed" cannot: whether cron is
  # still firing at all. A long gap here with a healthy last-deployed means
  # the schedule stopped, not that the site is up to date.
  if [[ -n "$PREV_RUN" ]]; then
    printf 'last ran:      %s (%s ago)\n' \
      "$(date -u -d "@$PREV_RUN" +'%Y-%m-%d %H:%M:%SZ' 2>/dev/null \
         || date -u -r "$PREV_RUN" +'%Y-%m-%d %H:%M:%SZ' 2>/dev/null \
         || echo "$PREV_RUN")" \
      "$(format_age "$((NOW_EPOCH - PREV_RUN))")"
  else
    printf 'last ran:      %s\n' '(none recorded)'
  fi
  printf 'max gap:       %s\n' "${MAX_GAP_HOURS:-(unset - no gap alerting)}"
  printf 'notify:        %s\n' "${NOTIFY_ADDR:-(none resolved from deploy.conf)}"
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
# Gap check, then stamp this run.
#
# Both happen BEFORE the lock, and deliberately: a run that exits 2 because
# a long deploy still holds the lock is a run that FIRED, and proving cron
# is alive is this file's whole job. Stamping after the lock would quietly
# under-report exactly the busiest periods.
#
# The alert can only ever fire on the next run that actually happens - a
# cron that is never going to fire again cannot report its own absence, and
# nothing in this script can change that. It catches a schedule that went
# sparse, not one that died outright.
#
# DEFAULT 30 HOURS, changed 15 August 2026, reversing the position directly
# above. That position - the repo must not guess a threshold, because the
# interval lives in cPanel - is sound in principle and cost more than it
# saved in practice. church-space.site ran for weeks with its last-deployed
# commit stuck, and produced no signal at all, because "no alerting" is
# indistinguishable from "nothing to report" from the outside. A default
# that is occasionally wrong beats a silence that is always ambiguous.
#
# 30 hours suits a daily cron with six hours of slack. A clone on a different
# interval overrides it in deploy.conf exactly as before, and a clone that
# genuinely wants silence sets AUTOPULL_MAX_GAP_HOURS=0.
# ---------------------------------------------------------------------------
: "${MAX_GAP_HOURS:=30}"
if [[ "$MAX_GAP_HOURS" == "0" ]]; then
  MAX_GAP_HOURS=""
fi
if [[ -n "$MAX_GAP_HOURS" ]]; then
  if [[ "$MAX_GAP_HOURS" =~ ^[0-9]+$ ]] && [[ "$MAX_GAP_HOURS" -gt 0 ]]; then
    if [[ -n "$PREV_RUN" && "$NOW_EPOCH" -gt 0 ]]; then
      RUN_GAP=$((NOW_EPOCH - PREV_RUN))
      if [[ "$RUN_GAP" -gt $((MAX_GAP_HOURS * 3600)) ]]; then
        announce "cpanel-autopull: previous run was $(format_age "$RUN_GAP") ago, over the ${MAX_GAP_HOURS}h limit"
        log "GAP   previous run $(format_age "$RUN_GAP") ago exceeds ${MAX_GAP_HOURS}h"
        send_alert "MISSED RUNS" \
          "Runs were missed: the previous autopull was $(format_age "$RUN_GAP") ago, which is over the ${MAX_GAP_HOURS}h AUTOPULL_MAX_GAP_HOURS limit. The schedule in cPanel -> Cron Jobs is the place to check."
      fi
    fi
  else
    err "AUTOPULL_MAX_GAP_HOURS is not a positive integer: '$MAX_GAP_HOURS' (ignoring)"
    log "GAP   ignoring invalid AUTOPULL_MAX_GAP_HOURS='$MAX_GAP_HOURS'"
  fi
fi

printf '%s\n' "$NOW_EPOCH" >"$LASTRUN_FILE" 2>/dev/null \
  || err "could not record this run in $LASTRUN_FILE"

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
  mkdir "$LOCK_DIR" 2>/dev/null || fail 1 "cannot acquire lock at $LOCK_DIR"
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
  fail 3 "detached HEAD in $REPOSITORY_ROOT - check the clone out on a branch"
fi

say "pulling $CURRENT_BRANCH in $REPOSITORY_ROOT"
if ! pull_output=$(git pull --ff-only 2>&1); then
  # Raw multi-line output to stderr for cron, flattened into the summary so
  # it survives into the log line and the email body.
  printf '%s\n' "$pull_output" >&2
  fail 3 "git pull --ff-only failed on branch $CURRENT_BRANCH: $(printf '%s' "$pull_output" | tr '\n' ' ')"
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
