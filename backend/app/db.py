"""The database: SQLite in DATA_DIR. Three small tables, so plain sqlite3 without an ORM.

- people: a copy of who may play (from the hub, or LOCAL_PEOPLE), so a parent sees children who never played yet and
  someone who left is hidden, not deleted.
- players: Stars, the numbers of `day`, and the parent's settings.
- events: every earning visit and round bought, under the key the page made up, so a request sent twice counts once.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE people (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    color TEXT,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE players (
    person_id INTEGER PRIMARY KEY,
    stars INTEGER NOT NULL DEFAULT 0,
    day TEXT NOT NULL DEFAULT '',
    visits INTEGER NOT NULL DEFAULT 0,
    play_seconds INTEGER NOT NULL DEFAULT 0,
    daily_goal INTEGER NOT NULL DEFAULT 2,
    play_minutes INTEGER
);
CREATE TABLE events (
    person_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    kind TEXT NOT NULL,
    building TEXT NOT NULL,
    stars INTEGER NOT NULL,
    at TEXT NOT NULL,
    PRIMARY KEY (person_id, key)
);
"""
VERSION = 1


def path() -> Path:
    folder = Path(os.getenv("DATA_DIR") or "./data")
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "brightville.db"


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(path(), timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    if connection.execute("PRAGMA user_version").fetchone()[0] < VERSION:
        connection.execute("BEGIN IMMEDIATE")
        # Another request may have set it up while this one waited for the lock
        if connection.execute("PRAGMA user_version").fetchone()[0] < VERSION:
            for statement in SCHEMA.split(";"):
                if statement.strip():
                    connection.execute(statement)
            connection.execute(f"PRAGMA user_version = {VERSION}")
        connection.execute("COMMIT")
    return connection


@contextmanager
def writing(connection: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """One change, all or nothing; a second writer waits instead of reading numbers about to change."""
    connection.execute("BEGIN IMMEDIATE")
    try:
        yield connection
    except BaseException:
        connection.execute("ROLLBACK")
        raise
    connection.execute("COMMIT")
