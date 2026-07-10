#!/usr/bin/env bash
# Starts/stops a local PostgreSQL 16 cluster and a local Redis instance for
# SignalWatch development, without requiring Docker (no daemon available in
# this environment) or systemd (no privileged/service-manager access here).
# Ports are non-default (5433 / 6380) to avoid clashing with any other
# Postgres/Redis instance that might already be running.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/.data"
PGDATA="$DATA_DIR/pgdata"
PG_PORT=5433
PG_LOG="$DATA_DIR/postgres.log"
PG_BIN="/usr/lib/postgresql/16/bin"
REDIS_PORT=6380
REDIS_LOG="$DATA_DIR/redis.log"
REDIS_PIDFILE="$DATA_DIR/redis.pid"

DB_NAME="signalwatch"
DB_USER="signalwatch"
DB_PASSWORD="localdevpass"

mkdir -p "$DATA_DIR"

pg_running() {
  "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1
}

redis_running() {
  redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1
}

start_postgres() {
  if [ ! -d "$PGDATA" ]; then
    echo "Initializing new PostgreSQL cluster at $PGDATA ..."
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$DATA_DIR"
    su postgres -c "$PG_BIN/initdb -D '$PGDATA' --auth=trust --username=postgres" >/dev/null
  fi
  chown -R postgres:postgres "$PGDATA"

  if pg_running; then
    echo "PostgreSQL already running on port $PG_PORT."
  else
    echo "Starting PostgreSQL on port $PG_PORT ..."
    su postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -l '$PG_LOG' -o '-p $PG_PORT -k /tmp -c listen_addresses=localhost' start"
    for i in $(seq 1 20); do
      if su postgres -c "$PG_BIN/pg_isready -p $PG_PORT -h localhost" >/dev/null 2>&1; then
        break
      fi
      sleep 0.5
    done
  fi

  # Idempotently ensure the app role + database exist.
  su postgres -c "$PG_BIN/psql -h localhost -p $PG_PORT -U postgres -tc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" | grep -q 1 || \
    su postgres -c "$PG_BIN/psql -h localhost -p $PG_PORT -U postgres -c \"CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD' CREATEDB;\""
  su postgres -c "$PG_BIN/psql -h localhost -p $PG_PORT -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" | grep -q 1 || \
    su postgres -c "$PG_BIN/psql -h localhost -p $PG_PORT -U postgres -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""

  echo "PostgreSQL ready: postgresql://$DB_USER:$DB_PASSWORD@localhost:$PG_PORT/$DB_NAME"
}

stop_postgres() {
  if pg_running; then
    echo "Stopping PostgreSQL ..."
    su postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' stop -m fast"
  else
    echo "PostgreSQL is not running."
  fi
}

start_redis() {
  if redis_running; then
    echo "Redis already running on port $REDIS_PORT."
  else
    echo "Starting Redis on port $REDIS_PORT ..."
    redis-server --port "$REDIS_PORT" --daemonize yes --dir "$DATA_DIR" \
      --dbfilename redis.rdb --logfile "$REDIS_LOG" --pidfile "$REDIS_PIDFILE" \
      --bind 127.0.0.1 --protected-mode yes
    for i in $(seq 1 20); do
      if redis_running; then break; fi
      sleep 0.3
    done
  fi
  echo "Redis ready: redis://localhost:$REDIS_PORT"
}

stop_redis() {
  if redis_running; then
    echo "Stopping Redis ..."
    redis-cli -p "$REDIS_PORT" shutdown nosave || true
  else
    echo "Redis is not running."
  fi
}

status() {
  if pg_running; then echo "postgres: RUNNING (port $PG_PORT)"; else echo "postgres: STOPPED"; fi
  if redis_running; then echo "redis:    RUNNING (port $REDIS_PORT)"; else echo "redis:    STOPPED"; fi
}

case "${1:-}" in
  start)
    start_postgres
    start_redis
    ;;
  stop)
    stop_postgres
    stop_redis
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
