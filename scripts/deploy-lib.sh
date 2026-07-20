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
# Shell: bash (sourced by cpanel-deploy.sh, which is itself bash - see its
# header comment for why). Sourcing contract:
#
#   Caller must set BEFORE sourcing:
#     REPOSITORY_ROOT       - repo checkout root (caller already cd'd there)
#
#   Sourcing defines:
#     LOG_FILE              - tee target for the caller's `main | tee` pipe
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
# Notification: best-effort, always attempted exactly once per address in
# NOTIFY_EMAILS, and NEVER allowed to change the script's own exit status -
# cPanel uses that exit status for its own deployment UI, and it must
# reflect the BUILD/DEPLOY outcome only. The email body is the full run log.
# ---------------------------------------------------------------------------
NOTIFIED=0
MAIL_OK=0
deploy_lib_notify() {
  local status="$1" RESULT SUBJECT addr
  [ "$NOTIFIED" -eq 1 ] && return 0
  NOTIFIED=1

  if [ "${#NOTIFY_EMAILS[@]}" -eq 0 ]; then
    echo "=== No notification addresses configured; skipping notification ==="
    return 0
  fi

  if [ "$status" -eq 0 ]; then RESULT="SUCCESS"; else RESULT="FAILURE"; fi
  SUBJECT="$DEPLOY_SUBJECT_PREFIX $RESULT - ${CPANEL_USER} - $(date -u +'%Y-%m-%d %H:%M:%SZ')"

  echo "=== Deploy finished: $RESULT (exit $status). Notifying: ${NOTIFY_EMAILS[*]} ==="

  for addr in "${NOTIFY_EMAILS[@]}"; do
    if command -v mail >/dev/null 2>&1; then
      if mail -s "$SUBJECT" "$addr" < "$LOG_FILE"; then
        MAIL_OK=1
        echo "=== Notification sent to $addr via mail(1) ==="
      else
        echo "=== WARNING: mail(1) exited non-zero for $addr; notification may not have been delivered ===" >&2
      fi
    elif [ -x /usr/sbin/sendmail ]; then
      if { printf 'To: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n' \
             "$addr" "$SUBJECT"; cat "$LOG_FILE"; } | /usr/sbin/sendmail -t; then
        MAIL_OK=1
        echo "=== Notification sent to $addr via /usr/sbin/sendmail ==="
      else
        echo "=== WARNING: sendmail exited non-zero for $addr; notification may not have been delivered ===" >&2
      fi
    else
      echo "=== WARNING: neither mail(1) nor /usr/sbin/sendmail found; notification skipped ===" >&2
      break
    fi
  done

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

  if [ "$MAIL_OK" -eq 1 ] || [ "${#NOTIFY_EMAILS[@]}" -eq 0 ]; then
    rm -f "$LOG_FILE" 2>/dev/null
  else
    echo "Deploy log retained at $LOG_FILE (mail delivery unavailable/failed)" >&2
  fi

  exit "$status"
}
