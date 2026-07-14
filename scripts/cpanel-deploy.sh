#!/bin/bash
#
# scripts/cpanel-deploy.sh
#
# Single entry point for the cPanel Git Version Control deployment. Kept as
# one script (not a multi-task .cpanel.yml list) so it controls its own
# success/failure handling and can guarantee an ADMIN_EMAIL notification
# fires on any failure, at any step - see .cpanel.yml's header comment for
# why a multi-task list can't make that guarantee (cPanel aborts every
# remaining task the instant one exits non-zero).
#
# Shell: bash, invoked explicitly as `bash scripts/cpanel-deploy.sh` from
# .cpanel.yml. bash's `${PIPESTATUS[0]}` is what makes "capture the full
# log AND keep it live in cPanel's own UI AND know the real exit code"
# simple and race-free (see the `main` invocation near the bottom).

set -u

REPOSITORY_ROOT="${REPOSITORY_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPOSITORY_ROOT" || exit 1

# ---------------------------------------------------------------------------
# Log file: everything main() prints (stdout+stderr) is teed here AND to
# this script's own stdout/stderr (so cPanel's UI still shows live
# progress). Placed under $HOME (survives outside the repo), with a
# repo-root fallback - that fallback path matches the repo's `*.log`
# .gitignore entry, so it can never accidentally get committed.
# ---------------------------------------------------------------------------
LOG_FILE=$(mktemp "${TMPDIR:-$HOME}/cpanel-deploy.XXXXXX.log" 2>/dev/null) \
  || LOG_FILE="$REPOSITORY_ROOT/cpanel-deploy-$$.log"

# ---------------------------------------------------------------------------
# deploy.conf: optional, untracked, per-clone settings. This is a
# single-domain site (dermotcochran.com), so unlike a multi-domain fork of
# this recipe, there's no THEME/CHARACTERS/ALT_DOMAINS narrowing here - just
# which cPanel account and domain this clone deploys to, and who gets
# notified. See sample-deploy.conf for the full key reference.
# ---------------------------------------------------------------------------
CPANEL_USER="dermotco"
DOMAIN="dermotcochran.com"
ADMIN_EMAIL=""
# shellcheck disable=SC1091
[ -f "$REPOSITORY_ROOT/deploy.conf" ] && . "$REPOSITORY_ROOT/deploy.conf"

# ADMIN_EMAIL defaults to admin@<DOMAIN> rather than staying unset, so this
# clone gets a deploy-log notification out of the box without needing its
# own deploy.conf entry.
[ -z "$ADMIN_EMAIL" ] && ADMIN_EMAIL="admin@$DOMAIN"

DEST="/home/$CPANEL_USER/public_html/"

{
  printf '=== cPanel deploy started: %s (user=%s domain=%s dest=%s) ===\n' \
    "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$CPANEL_USER" "$DOMAIN" "$DEST"
} | tee -a "$LOG_FILE"

# ---------------------------------------------------------------------------
# main(): ensure Node, install deps, build, and rsync-deploy to public_html.
# Runs as the left side of a pipe (`main | tee ...`) below, so any `exit`
# here only terminates this function's own pipeline subshell - the rest of
# the script (notify(), log persistence) still runs afterwards regardless
# of success or failure.
# ---------------------------------------------------------------------------
main() {
  echo "--- 1/5: ensure-node + npm ci ---"
  # shellcheck disable=SC1091
  . "$REPOSITORY_ROOT/scripts/ensure-node.sh" \
    || { echo "FAIL: scripts/ensure-node.sh (Node.js install/verify)" >&2; exit 1; }
  npm ci --no-audit --no-fund \
    || { echo "FAIL: npm ci" >&2; exit 1; }

  # SITE_DOMAIN feeds src/_data/site.js's absolute-URL building (used by
  # robots.njk/sitemap.njk) - exported so it's visible to the Eleventy
  # build below, which runs as a child process of this shell.
  export SITE_DOMAIN="$DOMAIN"

  echo "--- 2/5: eleventy build (SITE_DOMAIN=$SITE_DOMAIN) ---"
  # _site/ isn't cleaned by Eleventy between runs - it only writes/
  # overwrites - so wipe it first to guarantee a clean rebuild rather than
  # a mix of this run's and some earlier run's output.
  rm -rf "${REPOSITORY_ROOT:?}/_site" \
    || { echo "FAIL: could not clear _site/ before build" >&2; exit 1; }
  "$REPOSITORY_ROOT/node_modules/.bin/eleventy" \
    || { echo "FAIL: eleventy build" >&2; exit 1; }

  echo "--- 3/5: verify _site/ exists ---"
  test -d "$REPOSITORY_ROOT/_site" \
    || { echo "FAIL: _site/ was not produced by eleventy" >&2; exit 1; }

  echo "--- 4/5: rsync deploy ---"
  # --exclude keeps AutoSSL/Let's Encrypt's domain-validation directory out
  # of rsync's view entirely - it's never part of the Eleventy build, so
  # without this, --delete-delay would remove it (and any in-progress
  # certificate challenge) on every single deploy.
  rsync -av --delete-delay --exclude=.well-known/acme-challenge/ "$REPOSITORY_ROOT/_site/" "$DEST" \
    || { echo "FAIL: rsync to $DEST" >&2; exit 1; }

  echo "--- 5/5: post-deploy checks ---"
  test -f "${DEST}index.html" \
    || { echo "FAIL: post-deploy check - ${DEST}index.html missing" >&2; exit 1; }
  # cPanel is Apache-hosted, so it's the only target that actually reads
  # .htaccess - a missing file here would silently deploy with none of its
  # security headers (CSP, X-Frame-Options, etc.) instead of failing loudly.
  test -f "${DEST}.htaccess" \
    || { echo "FAIL: post-deploy check - ${DEST}.htaccess missing" >&2; exit 1; }
  test -f "${DEST}.well-known/security.txt" \
    || { echo "FAIL: post-deploy check - ${DEST}.well-known/security.txt missing" >&2; exit 1; }

  echo "=== Build + deploy completed successfully ==="
}

# Foreground pipe (NOT `exec > >(tee ...)`): the shell blocks until both
# main() and tee have fully finished, so LOG_FILE is guaranteed complete
# and flushed by the time we read it below - no race with the notify step.
main 2>&1 | tee -a "$LOG_FILE"
STATUS=${PIPESTATUS[0]}

# ---------------------------------------------------------------------------
# Notification: best-effort, never allowed to change the script's own exit
# status - cPanel uses that exit status for its own deployment UI, and it
# must reflect the BUILD/DEPLOY outcome only.
# ---------------------------------------------------------------------------
NOTIFIED=0
MAIL_OK=0
notify() {
  status="$1"
  [ "$NOTIFIED" -eq 1 ] && return 0
  NOTIFIED=1

  if [ "$status" -eq 0 ]; then RESULT="SUCCESS"; else RESULT="FAILURE"; fi
  SUBJECT="[dermot-cochran-photography deploy] $RESULT - ${CPANEL_USER} - $(date -u +'%Y-%m-%d %H:%M:%SZ')"

  echo "=== Deploy finished: $RESULT (exit $status). Notifying: $ADMIN_EMAIL ==="

  if command -v mail >/dev/null 2>&1; then
    if mail -s "$SUBJECT" "$ADMIN_EMAIL" < "$LOG_FILE"; then
      MAIL_OK=1
      echo "=== Notification sent to $ADMIN_EMAIL via mail(1) ==="
    else
      echo "=== WARNING: mail(1) exited non-zero for $ADMIN_EMAIL; notification may not have been delivered ===" >&2
    fi
  elif [ -x /usr/sbin/sendmail ]; then
    if { printf 'To: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n' \
           "$ADMIN_EMAIL" "$SUBJECT"; cat "$LOG_FILE"; } | /usr/sbin/sendmail -t; then
      MAIL_OK=1
      echo "=== Notification sent to $ADMIN_EMAIL via /usr/sbin/sendmail ==="
    else
      echo "=== WARNING: sendmail exited non-zero for $ADMIN_EMAIL; notification may not have been delivered ===" >&2
    fi
  else
    echo "=== WARNING: neither mail(1) nor /usr/sbin/sendmail found; notification skipped ===" >&2
  fi

  return 0   # never let a mail failure propagate
}

# Safety net: also fire on unexpected termination (e.g. a signal) so a
# partial log still gets mailed, without double-sending on the normal path
# (the NOTIFIED guard makes this idempotent).
trap 'notify "$?"' EXIT

notify "$STATUS"

# ---------------------------------------------------------------------------
# Persist a copy of every run's log locally, regardless of mail delivery, so
# past deploys can be inspected without needing email at all. deploy-logs/
# is untracked (gitignored) - host-local operational data, not repo content.
# One file per attempt (timestamp + result), pruned to the most recent
# LOG_RETENTION runs so it can't grow unbounded on a quota-limited account.
# ---------------------------------------------------------------------------
LOG_RETENTION=20
LOG_DIR="$REPOSITORY_ROOT/deploy-logs"
mkdir -p "$LOG_DIR" 2>/dev/null
if [ "$STATUS" -eq 0 ]; then LOG_RESULT="SUCCESS"; else LOG_RESULT="FAILURE"; fi
PERSISTED_LOG="$LOG_DIR/$(date -u +'%Y-%m-%dT%H-%M-%SZ')-$LOG_RESULT.log"
if cp "$LOG_FILE" "$PERSISTED_LOG" 2>/dev/null; then
  echo "=== Deploy log saved to $PERSISTED_LOG ==="
  # Filenames are ISO-8601-prefixed, so lexical sort is chronological sort;
  # drop everything but the newest LOG_RETENTION files.
  ls -1 "$LOG_DIR" 2>/dev/null | sort | head -n "-$LOG_RETENTION" | while IFS= read -r old; do
    rm -f "$LOG_DIR/$old"
  done
else
  echo "=== WARNING: could not persist deploy log to $LOG_DIR ===" >&2
fi

if [ "$MAIL_OK" -eq 1 ]; then
  rm -f "$LOG_FILE" 2>/dev/null
else
  echo "Deploy log retained at $LOG_FILE (mail delivery unavailable/failed)" >&2
fi

exit "$STATUS"
