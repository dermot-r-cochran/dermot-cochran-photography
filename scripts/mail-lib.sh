#!/bin/bash
#
# scripts/mail-lib.sh
#
# The one mail transport shared by everything on the server that needs to
# reach a human: scripts/deploy-lib.sh (deploy outcomes, success or failure)
# and scripts/cpanel-autopull.sh (autopull's own failures, before any deploy
# has started).
#
# WHY THIS EXISTS: cron mails a job's output to the *system* mailbox of the
# account it runs under, which is not where anyone reads mail. Anything that
# should actually be seen has to be posted deliberately, to ADMIN_EMAIL. That
# was already true of deploys, and the fallback chain below was written once
# for them; autopull then needed the identical chain for its own failures.
# Two copies of a mailer is how one of them silently stops working, so it
# lives here instead.
#
# SHARED FILE - this exact file lives in BOTH the star-rangers and
# dermot-cochran-photography repositories and must stay byte-identical
# between them (same convention as scripts/deploy-lib.sh,
# scripts/ensure-node.sh and scripts/cpanel-autopull.sh). If you change it in
# one repo, port the identical change to the other and keep the two files
# diff-clean - `diff` against the sibling repo's copy before committing.
#
# Shell: bash. Sourced by callers that run under `set -u`, so every expansion
# here has to be safe when a variable is unset.
#
# SOURCING CONTRACT: sourcing this file MUST have no side effects - it
# defines one function and touches nothing else. No temp files, no git calls,
# no globals beyond the function name. That is deliberate and load-bearing
# rather than mere tidiness: cpanel-autopull.sh sources it on EVERY cron run,
# including the overwhelmingly common run that finds nothing new and exits in
# well under a second. An import side effect here would become litter on the
# account at the cron's frequency - which is exactly why autopull sources
# this file rather than deploy-lib.sh, whose own import creates a temp log
# file and shells out to `git describe`.
#
#   mail_lib_send <subject> <body-file> <addr>...
#     Mails the contents of <body-file> to every address given. Returns 0 if
#     at least one address was accepted by a transport, 1 otherwise (no
#     usable transport, no valid arguments, or every attempt failed).
#
#     Progress and warnings go to stdout/stderr. Callers that must not be
#     chatty should capture the output rather than expecting silence.

# ---------------------------------------------------------------------------
# mail(1) first, /usr/sbin/sendmail second. cPanel hosts normally have both,
# but which one works varies by account and neither is guaranteed - so a
# missing transport is reported and never treated as fatal. Delivery failure
# must never take down the caller: a deploy that worked and failed to send
# its email is still a deploy that worked, and an autopull failure that
# cannot be emailed still has to exit with its own real status.
# ---------------------------------------------------------------------------
mail_lib_send() {
  local subject body addr sent

  subject="${1:-}"
  body="${2:-}"
  [ "$#" -ge 3 ] || return 1
  shift 2

  [ -n "$subject" ] || return 1
  [ -r "$body" ] || return 1

  sent=0
  for addr in "$@"; do
    [ -n "$addr" ] || continue

    if command -v mail >/dev/null 2>&1; then
      if mail -s "$subject" "$addr" < "$body"; then
        sent=1
        echo "=== Notification sent to $addr via mail(1) ==="
      else
        echo "=== WARNING: mail(1) exited non-zero for $addr; notification may not have been delivered ===" >&2
      fi
    elif [ -x /usr/sbin/sendmail ]; then
      if { printf 'To: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n' \
             "$addr" "$subject"; cat "$body"; } | /usr/sbin/sendmail -t; then
        sent=1
        echo "=== Notification sent to $addr via /usr/sbin/sendmail ==="
      else
        echo "=== WARNING: sendmail exited non-zero for $addr; notification may not have been delivered ===" >&2
      fi
    else
      # No transport at all: say so once and stop, rather than repeating the
      # same warning per address.
      echo "=== WARNING: neither mail(1) nor /usr/sbin/sendmail found; notification skipped ===" >&2
      break
    fi
  done

  [ "$sent" -eq 1 ]
}
