#!/bin/bash
#
# scripts/deploy-lib.sh
#
# Shared deploy machinery for scripts/cpanel-deploy.sh: log-file setup, the
# notification-email list, the notify-on-any-outcome mailer, and per-run log
# persistence/pruning. Everything here is site-agnostic; everything
# site-specific (what to build, where to rsync it, which config keys exist)
# stays in each repo's own cpanel-deploy.sh.
#
# SHARED FILE - this exact file lives in BOTH the star-rangers and
# dermot-cochran-photography repositories and must stay byte-identical
# between them (same convention as scripts/ensure-node.sh, which already
# is). If you change it in one repo, port the identical change to the other
# and keep the two files diff-clean - `diff` against the sibling repo's copy
# before committing.
#
# The mail transport itself lives in scripts/mail-lib.sh (also shared), so
# that scripts/cpanel-autopull.sh can reach a human for its OWN failures -
# the ones that happen before this file is ever sourced - without a second
# copy of the same fallback chain.
#
# Shell: bash (sourced by cpanel-deploy.sh, which is itself bash - see its
# header comment for why). Sourcing contract:
#
#   Caller must set BEFORE sourcing:
#     REPOSITORY_ROOT       - repo checkout root (caller already cd'd there)
#
#   Sourcing defines:
#     LOG_FILE              - tee target for the caller's `main | tee` pipe
#     DEPLOY_VERSION        - what this run is shipping, from `git describe`;
#                             exported, so the Eleventy build below the caller
#                             can stamp it into the site (see src/_data/build.js)
#     deploy_lib_add_notify_email <addr>
#                           - append an address to the notification list,
#                             deduping; empty addresses are ignored
#     deploy_lib_finish <status>
#                           - notify every listed address (best-effort,
#                             never changes <status>), persist + prune the
#                             run log under deploy-logs/, and exit <status>
#
#   Caller must set BEFORE calling deploy_lib_finish:
#     DEPLOY_SUBJECT_PREFIX - notification subject prefix, e.g.
#                             "[star-rangers deploy]"
#     CPANEL_USER           - included in the subject line, since every
#                             clone shares the same .cpanel.yml
#
#   Caller MAY set (normally by sourcing deploy.conf) BEFORE deploy_lib_finish:
#     NOTIFY_ON             - which outcomes get the deploy-log email; see
#                             deploy_lib_notify() below. Unset means "always".

# ---------------------------------------------------------------------------
# Mail transport. Sourced rather than reimplemented, and sourced first so
# deploy_lib_notify() below can rely on it. Failing to find it is fatal here
# (unlike a failed send, which never is): a deploy that cannot report its own
# outcome is the exact silent-failure mode this machinery exists to prevent.
# ---------------------------------------------------------------------------
# shellcheck source=scripts/mail-lib.sh
. "$REPOSITORY_ROOT/scripts/mail-lib.sh" \
  || { echo "FAIL: could not source scripts/mail-lib.sh" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Log file: everything the caller's main() prints (stdout+stderr) is teed
# here AND to the script's own stdout/stderr (so cPanel's UI still shows
# live progress). Placed under $HOME (survives outside the repo), with a
# repo-root fallback - that fallback path matches the repo's `*.log`
# .gitignore entry, so it can never accidentally get committed.
# ---------------------------------------------------------------------------
LOG_FILE=$(mktemp "${TMPDIR:-$HOME}/cpanel-deploy.XXXXXX.log" 2>/dev/null) \
  || LOG_FILE="$REPOSITORY_ROOT/cpanel-deploy-$$.log"

# ---------------------------------------------------------------------------
# DEPLOY_VERSION: what this run is actually shipping.
#
# Until this existed there was no way to tell what any live domain was
# serving - not from the deploy email, not from the server, not from the
# site. A deploy that failed on one of several domains, or an account whose
# cron was never installed, showed up only as somebody eventually noticing
# missing content.
#
# `git describe --tags --always --dirty` covers both repositories that share
# this file: where there are release tags it reads like `v1.16.0-3-gb4b56f4`
# (release, commits since it, exact commit); where there are none it falls
# back to the short commit alone, which is all the identity that repo has.
# `--dirty` marks a checkout with modified TRACKED files - untracked
# per-clone files like deploy.conf never trip it.
#
# Exported, not just logged: the caller's Eleventy build inherits it and
# stamps it into the built site, so each domain can be checked from outside
# with one request instead of trusting that a green deploy meant a
# successful rsync.
# ---------------------------------------------------------------------------
DEPLOY_VERSION=$(cd "$REPOSITORY_ROOT" 2>/dev/null && git describe --tags --always --dirty 2>/dev/null) \
  || DEPLOY_VERSION=""
[ -n "$DEPLOY_VERSION" ] || DEPLOY_VERSION="unknown"
export DEPLOY_VERSION

# ---------------------------------------------------------------------------
# NOTIFY_EMAILS: every address that should get this run's deploy-log email.
# The caller builds this up front, before its main() runs, via
# deploy_lib_add_notify_email() - it can't be built inside main(), because
# main() executes as the left side of a pipe (`main | tee ...`), which forks
# it into its own subshell, so any variable it computed would vanish the
# moment that pipe finished.
# ---------------------------------------------------------------------------
NOTIFY_EMAILS=()
deploy_lib_add_notify_email() {
  local e="$1" existing
  [ -z "$e" ] && return 0
  for existing in "${NOTIFY_EMAILS[@]:-}"; do
    [ "$existing" = "$e" ] && return 0
  done
  NOTIFY_EMAILS+=("$e")
}

# ---------------------------------------------------------------------------
# Notification: best-effort, attempted at most once per address in
# NOTIFY_EMAILS, and NEVER allowed to change the script's own exit status -
# cPanel uses that exit status for its own deployment UI, and it must
# reflect the BUILD/DEPLOY outcome only. The email body is the full run log.
#
# NOTIFY_ON (deploy.conf, since 2026-09-14) says which outcomes are mailed:
#
#   always    every attempt, success or failure. The default, and the only
#             behaviour before this key existed - so nothing changes for a
#             clone that has not set it.
#   warnings  every failure, plus a success whose log carries a warning from
#             the deploy scripts themselves (see deploy_lib_log_has_warnings
#             below). A clean success is not mailed.
#   failure   failures only.
#
# Why the middle value exists: a successful run is not always a quiet one.
# A domain that has lost its lib/editions.js entry deploys fine and warns;
# a defaulted ADMIN_EMAIL deploys fine and warns. Those lines were written
# to be read in the deploy email, and "failure" would demote them to a log
# file nobody opens. "warnings" keeps that channel and drops only the mail
# that says nothing. Two things nothing here can replace, so be aware of
# them before choosing it: a routine success email was the one regular proof
# that ADMIN_EMAIL actually delivers (a nonexistent admin@ address is
# accepted by the MTA and silently discarded - it happened on 2026-08-03),
# and after a merge the check that a domain really shipped is /version.txt,
# not the absence of mail.
#
# An unrecognised value is treated as "always" and said so: the safe
# direction for a typo in an alerting setting is more mail, not less.
# ---------------------------------------------------------------------------
NOTIFIED=0
MAIL_OK=0
MAIL_SKIPPED=0

# deploy_lib_log_has_warnings(): does the run log carry a warning the deploy
# scripts themselves raised? Matches only the three line shapes those scripts
# use - "WARN [label]: ...", "--- WARNING: ..." and "=== WARNING: ..." - and
# only at the start of a line. Deliberately NOT a loose match on "warn":
# `npm ci` prints "npm WARN deprecated ..." on most runs, Eleventy and
# Pagefind have warnings of their own, and counting any of those would turn
# "warnings" back into "always" on the first deprecated transitive dependency.
deploy_lib_log_has_warnings() {
  [ -r "$LOG_FILE" ] || return 1
  grep -q -E '^(WARN[^A-Za-z]|--- WARNING|=== WARNING)' "$LOG_FILE"
}

deploy_lib_notify() {
  local status="$1" RESULT SUBJECT MODE WARNED
  [ "$NOTIFIED" -eq 1 ] && return 0
  NOTIFIED=1

  if [ "${#NOTIFY_EMAILS[@]}" -eq 0 ]; then
    echo "=== No notification addresses configured; skipping notification ==="
    return 0
  fi

  MODE="${NOTIFY_ON:-always}"
  case "$MODE" in
    always|warnings|failure) ;;
    *)
      echo "=== WARNING: NOTIFY_ON='$MODE' is not one of always|warnings|failure; treating it as 'always' ===" >&2
      MODE="always"
      ;;
  esac

  WARNED=0
  if [ "$status" -eq 0 ] && deploy_lib_log_has_warnings; then WARNED=1; fi

  if [ "$status" -eq 0 ]; then
    if [ "$WARNED" -eq 1 ]; then RESULT="SUCCESS WITH WARNINGS"; else RESULT="SUCCESS"; fi
  else
    RESULT="FAILURE"
  fi

  if [ "$status" -eq 0 ]; then
    case "$MODE" in
      failure)
        echo "=== Deploy finished: $RESULT (exit 0). NOTIFY_ON=failure: not mailing a success ==="
        MAIL_SKIPPED=1
        return 0
        ;;
      warnings)
        if [ "$WARNED" -eq 0 ]; then
          echo "=== Deploy finished: $RESULT (exit 0). NOTIFY_ON=warnings: no warnings in the log, not mailing ==="
          MAIL_SKIPPED=1
          return 0
        fi
        ;;
    esac
  fi

  SUBJECT="$DEPLOY_SUBJECT_PREFIX $RESULT - ${CPANEL_USER} - ${DEPLOY_VERSION} - $(date -u +'%Y-%m-%d %H:%M:%SZ')"

  echo "=== Deploy finished: $RESULT (exit $status). Notifying: ${NOTIFY_EMAILS[*]} ==="

  # MAIL_OK gates whether deploy_lib_finish() may delete LOG_FILE below, so
  # it has to mean "at least one address was actually accepted" - which is
  # precisely mail_lib_send()'s return contract.
  if mail_lib_send "$SUBJECT" "$LOG_FILE" "${NOTIFY_EMAILS[@]}"; then
    MAIL_OK=1
  fi

  return 0   # never let a mail failure propagate
}

# ---------------------------------------------------------------------------
# deploy_lib_finish(): the caller's last line, after `main | tee` has fully
# completed and its real exit code has been captured from ${PIPESTATUS[0]}.
# Notifies, persists the log, and exits with the given status.
# ---------------------------------------------------------------------------
deploy_lib_finish() {
  local status="$1" LOG_RESULT PERSISTED_LOG

  # Safety net: also fire on unexpected termination (e.g. a signal) so a
  # partial log still gets mailed, without double-sending on the normal
  # path (the NOTIFIED guard makes this idempotent).
  trap 'deploy_lib_notify "$?"' EXIT

  deploy_lib_notify "$status"

  # -------------------------------------------------------------------------
  # Persist a copy of every run's log locally, regardless of NOTIFY_EMAILS,
  # so past deploys can be inspected without needing email at all.
  # deploy-logs/ is untracked (gitignored) - host-local operational data,
  # not repo content. One file per attempt (timestamp + result), pruned to
  # the most recent LOG_RETENTION runs so it can't grow unbounded on a
  # quota-limited account.
  # -------------------------------------------------------------------------
  local LOG_RETENTION=20
  local LOG_DIR="$REPOSITORY_ROOT/deploy-logs"
  mkdir -p "$LOG_DIR" 2>/dev/null
  if [ "$status" -eq 0 ]; then LOG_RESULT="SUCCESS"; else LOG_RESULT="FAILURE"; fi
  PERSISTED_LOG="$LOG_DIR/$(date -u +'%Y-%m-%dT%H-%M-%SZ')-$LOG_RESULT.log"
  if cp "$LOG_FILE" "$PERSISTED_LOG" 2>/dev/null; then
    echo "=== Deploy log saved to $PERSISTED_LOG ==="
    # Filenames are ISO-8601-prefixed, so lexical sort is chronological
    # sort; drop everything but the newest LOG_RETENTION files.
    ls -1 "$LOG_DIR" 2>/dev/null | sort | head -n "-$LOG_RETENTION" | while IFS= read -r old; do
      rm -f "$LOG_DIR/$old"
    done
  else
    echo "=== WARNING: could not persist deploy log to $LOG_DIR ===" >&2
  fi

  # A mail that NOTIFY_ON chose not to send is not a mail that failed: the
  # persisted copy above is the record, and the temp file goes the same way
  # it does after a successful send.
  if [ "$MAIL_OK" -eq 1 ] || [ "$MAIL_SKIPPED" -eq 1 ] || [ "${#NOTIFY_EMAILS[@]}" -eq 0 ]; then
    rm -f "$LOG_FILE" 2>/dev/null
  else
    echo "Deploy log retained at $LOG_FILE (mail delivery unavailable/failed)" >&2
  fi

  exit "$status"
}
