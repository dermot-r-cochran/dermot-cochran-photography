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
# Shared machinery (LOG_FILE, notification list + mailer, log persistence)
# comes from scripts/deploy-lib.sh - a file kept byte-identical between this
# repo and star-rangers (like ensure-node.sh); see its header for the
# sourcing contract. Everything below this point is site-specific.
# ---------------------------------------------------------------------------
# shellcheck source=scripts/deploy-lib.sh
. "$REPOSITORY_ROOT/scripts/deploy-lib.sh" \
  || { echo "FAIL: could not source scripts/deploy-lib.sh" >&2; exit 1; }
# shellcheck disable=SC2034  # consumed by deploy-lib.sh's deploy_lib_notify()
DEPLOY_SUBJECT_PREFIX="[dermot-cochran-photography deploy]"

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
deploy_lib_add_notify_email "$ADMIN_EMAIL"

DEST="/home/$CPANEL_USER/public_html/"

{
  printf '=== cPanel deploy started: %s (user=%s domain=%s dest=%s) ===\n' \
    "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$CPANEL_USER" "$DOMAIN" "$DEST"
} | tee -a "$LOG_FILE"

# ---------------------------------------------------------------------------
# main(): ensure Node, install deps, build, and rsync-deploy to public_html.
# Runs as the left side of a pipe (`main | tee ...`) below, so any `exit`
# here only terminates this function's own pipeline subshell - the rest of
# the script (deploy_lib_finish: notify, log persistence) still runs
# afterwards regardless of success or failure.
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
# and flushed by the time deploy_lib_finish reads it - no race with the
# notify step.
main 2>&1 | tee -a "$LOG_FILE"
STATUS=${PIPESTATUS[0]}

# Notify ADMIN_EMAIL with the full run log, persist + prune deploy-logs/,
# and exit with main()'s real status - all shared machinery; see
# deploy-lib.sh.
deploy_lib_finish "$STATUS"
