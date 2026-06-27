#!/bin/sh
# wallrus container entrypoint — LinuxServer.io-style PUID/PGID + privilege drop.
#
# Classic docker (container starts as root): make the data dir owned by
# PUID:PGID, set the umask, then drop to that uid/gid via setpriv before exec'ing
# the app — so the daemon never runs as root. Defaults to 1000:1000, the common
# desktop/NAS user, so a host operator can read the collection directly and share
# it over Samba/syncthing.
#
# Rootless podman (keep-id) / OpenShift random uid: the container ALREADY starts
# as a non-root uid that the userns maps onto the host data-dir owner. There we
# must NOT try to drop privileges — `setpriv --clear-groups` calls setgroups(2)
# which needs CAP_SETGID (→ "setpriv: setgroups failed: Operation not permitted"
# → exit 127 crash-loop), and the recursive chown would also EPERM. Detect the
# non-root case and exec the app as-is.
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UMASK="${UMASK:-027}"
DATA_DIR="${WALLRUS_DATA_DIR:-/data/wallrus}"

umask "$UMASK"
export HOME=/tmp
mkdir -p "$DATA_DIR" 2>/dev/null || true

if [ "$(id -u)" = "0" ]; then
	# Running as root → own the data dir, then drop privileges.
	# chown -R only when the owner doesn't already match, to avoid a slow
	# recursive chown on every restart once the image collection grows large.
	owner="$(stat -c '%u:%g' "$DATA_DIR" 2>/dev/null || echo '')"
	if [ "$owner" != "${PUID}:${PGID}" ]; then
		echo "wallrus: chown ${DATA_DIR} -> ${PUID}:${PGID}"
		chown -R "${PUID}:${PGID}" "$DATA_DIR"
	fi
	# exec so the app inherits PID 1 signal handling (graceful shutdown).
	exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
fi

# Already non-root (rootless userns maps us to the host data-dir owner): cannot
# and need not drop privileges. Run as the current uid.
echo "wallrus: running as uid $(id -u), no privilege drop"
exec "$@"
