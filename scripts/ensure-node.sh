#!/bin/sh
# Ensures a local Node.js runtime is available for the cPanel Git Version
# Control deployment tasks, without depending on cPanel's "Setup Node.js App"
# UI feature (not available/working on every hosting account).
#
# Downloads the official prebuilt Node.js tarball once into a cache directory
# under $HOME (outside the repo, so it survives across deploys and is never
# git-tracked), and reuses it on every subsequent deploy. Re-downloads
# automatically if NODE_VERSION below is bumped.
#
# Usage: source this file (". scripts/ensure-node.sh"), don't execute it -
# sourcing is what lets the PATH export below reach the calling shell/task.

NODE_VERSION="20.20.2"
NODE_HOME="$HOME/.cpanel-nodejs"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) NODE_ARCH="x64" ;;
  aarch64|arm64) NODE_ARCH="arm64" ;;
  *)
    echo "ensure-node.sh: unsupported architecture: $ARCH" >&2
    return 1 2>/dev/null || exit 1
    ;;
esac

if [ ! -x "$NODE_HOME/bin/node" ] || [ "$("$NODE_HOME/bin/node" -v)" != "v$NODE_VERSION" ]; then
  TMP_DIR="$HOME/.cpanel-nodejs-download"
  ARCHIVE_NAME="node-v$NODE_VERSION-linux-$NODE_ARCH"
  # .tar.gz, not .tar.xz: on CloudLinux/CageFS shared hosting (common for
  # cPanel), the account is often blocked from executing certain binaries,
  # including `xz`. If the installed `tar` wasn't built with liblzma linked
  # in, extracting a .tar.xz shells out to an external `xz` process to
  # decompress it, which then fails with "Cannot exec: Permission denied"
  # under that restriction. gzip decompression is compiled directly into
  # GNU tar (linked against zlib), so it never spawns an external process -
  # .tar.gz avoids the blocked binary entirely.
  URL="https://nodejs.org/dist/v$NODE_VERSION/$ARCHIVE_NAME.tar.gz"

  rm -rf "$NODE_HOME" "$TMP_DIR"
  mkdir -p "$TMP_DIR"

  (
    cd "$TMP_DIR" || exit 1

    if command -v curl >/dev/null 2>&1; then
      curl -fsSL -o node.tar.gz "$URL"
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O node.tar.gz "$URL"
    else
      echo "ensure-node.sh: need curl or wget to download Node.js" >&2
      exit 1
    fi
  ) && tar -xzf "$TMP_DIR/node.tar.gz" -C "$TMP_DIR" \
    && mv "$TMP_DIR/$ARCHIVE_NAME" "$NODE_HOME"

  STATUS=$?
  rm -rf "$TMP_DIR"

  if [ "$STATUS" -ne 0 ] || [ ! -x "$NODE_HOME/bin/node" ]; then
    echo "ensure-node.sh: failed to install Node.js v$NODE_VERSION" >&2
    return 1 2>/dev/null || exit 1
  fi
fi

export PATH="$NODE_HOME/bin:$PATH"
