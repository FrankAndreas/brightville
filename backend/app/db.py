"""The database: SQLite in DATA_DIR. A few small tables, so plain sqlite3 without an ORM.

- people: a copy of who may play (from the hub, or LOCAL_PEOPLE), so a parent sees children who never played yet and
  someone who left is hidden, not deleted.
- players: Stars, the numbers of `day`, and the parent's settings.
- events: every earning visit, round bought and visit to Malen or Ausmalen, under the key the page made up, so a
  request sent twice counts once.
- films: the YouTube films the parents chose for the Cinema.
- paintings: each child's paintings from Malen, picture and thumbnail.
- stickers: the stickers each child has earned, and whether the child has seen them yet.
- goal_days: the days a child reached the daily goal, with the goal of that day.
- settings: what the database itself must remember, e.g. `mode` (see claim_mode).
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

# Each step brings the database from the version before it to the next; `user_version` says how far it is
MIGRATIONS = [
    """
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
""",
    """
CREATE TABLE films (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT ''
);
""",
    """
CREATE TABLE paintings (
    person_id INTEGER NOT NULL,
    id TEXT NOT NULL,
    image BLOB NOT NULL,
    image_type TEXT NOT NULL,
    thumb BLOB NOT NULL,
    thumb_type TEXT NOT NULL,
    updated INTEGER NOT NULL,
    PRIMARY KEY (person_id, id)
);
""",
    """
CREATE TABLE stickers (
    person_id INTEGER NOT NULL,
    sticker_id TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (person_id, sticker_id)
);
CREATE TABLE goal_days (
    person_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    goal INTEGER NOT NULL,
    PRIMARY KEY (person_id, day)
);
""",
    """
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
""",
]
VERSION = len(MIGRATIONS)


def path() -> Path:
    """DATABASE_URL (sqlite:///<file>, as in the other family apps; the NAS update script backs it up from there), or
    brightville.db in DATA_DIR."""
    url = os.getenv("DATABASE_URL", "")
    file = Path(url.split("sqlite:///", 1)[1]) if url.startswith("sqlite:///") else None
    file = file or Path(os.getenv("DATA_DIR") or "./data") / "brightville.db"
    file.parent.mkdir(parents=True, exist_ok=True)
    return file


def statements(script: str) -> list[str]:
    """The statements of a migration, one by one. Split where SQLite says a statement is complete, so a `;` in a
    string or inside a trigger doesn't cut it. (executescript would commit first, giving up the lock that keeps two
    requests from migrating at once.)"""
    found: list[str] = []
    current = ""
    for piece in script.split(";")[:-1]:
        current += piece + ";"
        if sqlite3.complete_statement(current):
            if current.strip() != ";":
                found.append(current.strip())
            current = ""
    current += script.split(";")[-1]
    if current.strip():
        raise ValueError(f"A migration ends in the middle of a statement: {current.strip()[:60]}")
    return found


def connect() -> sqlite3.Connection:
    # One connection per request, used by one thread at a time; FastAPI may open it in one thread of its pool and
    # run the request in another, which sqlite3 refuses unless told
    connection = sqlite3.connect(path(), timeout=10, isolation_level=None, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    if connection.execute("PRAGMA user_version").fetchone()[0] < VERSION:
        connection.execute("BEGIN IMMEDIATE")
        # Another request may have brought it up to date while this one waited for the lock
        done = connection.execute("PRAGMA user_version").fetchone()[0]
        for step in MIGRATIONS[done:]:
            for statement in statements(step):
                connection.execute(statement)
        connection.execute(f"PRAGMA user_version = {VERSION}")
        connection.execute("COMMIT")
    return connection


def claim_mode(connection: sqlite3.Connection, mode: str) -> str:
    """The mode ("hub" or "local") the database was made in; the first start notes the one given.

    Both number their people from 1: a database from playing without the hub, moved to the NAS, would give "Kind"'s
    Stars to whoever is person 1 in the hub. The caller refuses to start when the answer isn't `mode`."""
    with writing(connection):
        connection.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('mode', ?)", (mode,))
        return str(connection.execute("SELECT value FROM settings WHERE key = 'mode'").fetchone()[0])


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
