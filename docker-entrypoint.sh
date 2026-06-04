#!/bin/sh
# wallrus container entrypoint — LinuxServer.io-style PUID/PGID + privilege drop.
#
# Runs as root, makes the data dir owned by PUID:PGID, sets the umask, then drops
# to that uid/gid via setpriv (from util-linux, already in the base image) before
# exec'ing the app — so the daemon never runs as root. Defaults to 1000:1000, the
# common desktop/NAS user, so a host operator can read the collection directly and
# share it over Samba/syncthing.
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UMASK="${UMASK:-027}"
DATA_DIR="${WALLRUS_DATA_DIR:-/data/wallrus}"

mkdir -p "$DATA_DIR"

# chown -R only when the data dir owner doesn't already match, to avoid a slow
# recursive chown on every restart once the image collection grows large.
owner="$(stat -c '%u:%g' "$DATA_DIR" 2>/dev/null || echo '')"
if [ "$owner" != "${PUID}:${PGID}" ]; then
	echo "wallrus: chown ${DATA_DIR} -> ${PUID}:${PGID}"
	chown -R "${PUID}:${PGID}" "$DATA_DIR"
fi

umask "$UMASK"
export HOME=/tmp

# exec so the app inherits PID 1 signal handling (graceful shutdown).
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
