#!/bin/bash
# Nightly auto-update for a Brightville Docker deployment (e.g. on a Synology NAS).
#
# Pulls the app image and, only if a newer one was published, recreates the
# container and waits until it is healthy. Without a new image it only checks
# that the app is healthy. The app keeps no data, so there is nothing to back
# up. The compose file is never changed by this script.
#
# Usage:   nas-update.sh [--force] [APP_DIR]
#   APP_DIR  folder containing the compose file (compose.yaml, docker-compose.yml, ...)
#            (default: the folder this script is in)
#   --force  recreate the container even if no new image was pulled
#            (e.g. after editing the compose file)
#
# Exit codes: 0 = up to date or updated successfully, 1 = failure (including an
#             app that isn't healthy).
# See docs/deploy-nas.md ("Automatic updates") for the Task Scheduler setup.

set -uo pipefail

# Task Scheduler runs with a minimal PATH; Docker lives in /usr/local/bin on DSM
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SERVICE=brightville
HEALTH_TIMEOUT=300

FORCE=0
APP_DIR=""
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
        *) APP_DIR="$arg" ;;
    esac
done
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$APP_DIR" || { echo "Cannot cd to $APP_DIR"; exit 1; }

LOG_DIR="$APP_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/update.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"; }
fail() { log "FAILED: $*"; exit 1; }

# Only one run at a time (mkdir is atomic; flock isn't available everywhere)
LOCK_DIR="$APP_DIR/.update.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "Another update is running (remove $LOCK_DIR if it is stale)"
    exit 1
fi
trap 'rmdir "$LOCK_DIR"' EXIT

compose_file=""
for f in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    [ -f "$f" ] && { compose_file=$f; break; }
done
[ -n "$compose_file" ] || fail "no compose file (compose.yaml or docker-compose.yml) in $APP_DIR"

if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
else
    fail "neither 'docker compose' nor 'docker-compose' found"
fi

# Reuse the project name of the running stack, so a project created in the
# Container Manager UI isn't duplicated under the folder name
if [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
    app_id=$("${COMPOSE[@]}" ps -q "$SERVICE" 2>/dev/null | head -n1)
    [ -z "$app_id" ] && app_id=$(docker ps -aq --filter name='^brightville$' | head -n1)
    if [ -n "$app_id" ]; then
        project=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$app_id" 2>/dev/null)
        workdir=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$app_id" 2>/dev/null)
        # Never take over a stack that was started from another folder
        if [ -n "$workdir" ] && [ "$(cd "$workdir" 2>/dev/null && pwd -P)" != "$(pwd -P)" ]; then
            fail "brightville belongs to the stack in $workdir, not $APP_DIR; run the script from that folder or set COMPOSE_PROJECT_NAME"
        fi
        [ -n "$project" ] && export COMPOSE_PROJECT_NAME="$project"
    fi
fi
compose() { "${COMPOSE[@]}" "$@"; }

# The app's container, running or stopped
container() { compose ps -a -q "$SERVICE" 2>/dev/null | head -n1; }

# Wait up to $HEALTH_TIMEOUT seconds for the image's healthcheck;
# leaves the last status in $status
wait_healthy() {
    local deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
    status=""
    while [ "$(date +%s)" -lt "$deadline" ]; do
        status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$(container)" 2>/dev/null)
        [ "$status" = "healthy" ] && return 0
        sleep 10
    done
    return 1
}

# True if the container is missing or runs an older image than the local tag
needs_update() {
    local cid image running latest
    cid=$(container)
    [ -z "$cid" ] && return 0
    image=$(docker inspect -f '{{.Config.Image}}' "$cid") || return 0
    running=$(docker inspect -f '{{.Image}}' "$cid")
    latest=$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null) || return 0
    [ "$running" != "$latest" ]
}

log "Checking for updates in $APP_DIR (project: ${COMPOSE_PROJECT_NAME:-default})"
compose pull --quiet "$SERVICE" >>"$LOG_FILE" 2>&1 || fail "docker pull failed (network or registry login?)"

if ! needs_update && [ "$FORCE" -eq 0 ]; then
    # Nothing to install, but report a broken app instead of calling it up to date
    if ! wait_healthy; then
        compose logs --tail 50 "$SERVICE" >>"$LOG_FILE" 2>&1
        fail "up to date, but the app is not healthy (status: ${status:-unknown}); last logs in $LOG_FILE"
    fi
    log "Up to date"
    exit 0
fi
needs_update && log "Updating to the new image" || log "Recreating the container (forced)"

# Keep the running image as :previous, so pruning can't remove it and a
# rollback stays possible (see "Rolling back" in docs/deploy-nas.md)
cid=$(container)
if [ -n "$cid" ] && needs_update; then
    image=$(docker inspect -f '{{.Config.Image}}' "$cid")
    docker tag "$(docker inspect -f '{{.Image}}' "$cid")" "${image%:*}:previous" \
        && log "Kept current image as ${image%:*}:previous"
fi

compose up -d "$SERVICE" >>"$LOG_FILE" 2>&1 || fail "docker compose up failed"

if ! wait_healthy; then
    compose logs --tail 50 "$SERVICE" >>"$LOG_FILE" 2>&1
    fail "app not healthy after ${HEALTH_TIMEOUT}s (status: ${status:-unknown}); last logs in $LOG_FILE"
fi

# Remove superseded (dangling) images to save disk space
docker image prune -f >/dev/null 2>&1

log "Update complete, app healthy"
