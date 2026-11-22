"""The Oberstufe's dates and times (the Kalender, src/core/dates/): per child and task kind `<lang>:<kind>`, his first
answers of the last 10 (newest last). The tasks themselves are made by rules on the page; the server keeps the record.
"""

import json
import sqlite3
from datetime import date, timedelta
from typing import TypedDict

from . import clock
from .db import writing
from .vocab import KEEP_KEYS_DAYS, LANGS, SEEN_KEYS

RECENT = 10


class Answer(TypedDict):
    kind: str
    right: bool


def state(db: sqlite3.Connection, person_id: int, seen: bool = True) -> dict:
    """His record per task kind, and the keys of his latest results the server has"""
    progress = {
        r["kind"]: {"recent": [bool(x) for x in json.loads(r["recent"])]}
        for r in db.execute("SELECT kind, recent FROM dates_progress WHERE person_id = ?", (person_id,))
    }
    out: dict = {"progress": progress}
    if seen:
        out["seen"] = [
            r["key"]
            for r in db.execute(
                "SELECT key FROM dates_keys WHERE person_id = ? ORDER BY rowid DESC LIMIT ?", (person_id, SEEN_KEYS)
            )
        ]
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, lang: str, answers: list[Answer]) -> None:
    """One round's first answers, counted once (by its key); a kind of the other language, or not `<lang>:<kind>`, is
    skipped"""
    today = clock.today()
    forget = (date.fromisoformat(today) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM dates_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        inserted = db.execute(
            "INSERT OR IGNORE INTO dates_keys (person_id, key, day) VALUES (?, ?, ?)", (person_id, key, today)
        )
        if inserted.rowcount != 1:
            return
        for answer in answers:
            kind = answer["kind"]
            parts = kind.split(":")
            if lang not in LANGS or len(parts) != 2 or parts[0] != lang or not parts[1]:
                continue
            row = db.execute(
                "SELECT recent FROM dates_progress WHERE person_id = ? AND kind = ?", (person_id, kind)
            ).fetchone()
            recent: list[bool] = [bool(x) for x in json.loads(row["recent"])] if row else []
            recent = (recent + [answer["right"]])[-RECENT:]
            db.execute(
                "INSERT INTO dates_progress (person_id, kind, recent) VALUES (?, ?, ?) "
                "ON CONFLICT (person_id, kind) DO UPDATE SET recent = excluded.recent",
                (person_id, kind, json.dumps(recent)),
            )
