"""The Oberstufe's reading room (shared/reading/<lang>.json): per child and text `<lang>:<topic>:<id>`, how often he
read it, the last day he read it and how many of its four questions he got right that time. The page picks the next
text from this (src/core/reading/rules.ts); the server keeps the record."""

import sqlite3
from datetime import date, timedelta
from typing import TypedDict

from . import clock
from .db import writing
from .vocab import KEEP_KEYS_DAYS, LANGS, SEEN_KEYS


class Answer(TypedDict):
    text: str
    right: int


def state(db: sqlite3.Connection, person_id: int, seen: bool = True) -> dict:
    """His record per text, and the keys of his latest visits the server has"""
    progress = {
        r["text"]: {"reads": r["reads"], "last_read": r["last_read"], "last_right": r["last_right"]}
        for r in db.execute(
            "SELECT text, reads, last_read, last_right FROM reading_progress WHERE person_id = ?", (person_id,)
        )
    }
    out: dict = {"progress": progress}
    if seen:
        out["seen"] = [
            r["key"]
            for r in db.execute(
                "SELECT key FROM reading_keys WHERE person_id = ? ORDER BY rowid DESC LIMIT ?", (person_id, SEEN_KEYS)
            )
        ]
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, lang: str, answers: list[Answer]) -> None:
    """One visit's texts, counted once (by its key); a text of the other language, or not `<lang>:<topic>:<id>`, is
    skipped"""
    today = clock.today()
    forget = (date.fromisoformat(today) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM reading_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        inserted = db.execute(
            "INSERT OR IGNORE INTO reading_keys (person_id, key, day) VALUES (?, ?, ?)", (person_id, key, today)
        )
        if inserted.rowcount != 1:
            return
        for answer in answers:
            text = answer["text"]
            parts = text.split(":", 2)
            if lang not in LANGS or len(parts) != 3 or parts[0] != lang or not parts[1] or not parts[2]:
                continue
            db.execute(
                "INSERT INTO reading_progress (person_id, text, reads, last_read, last_right) VALUES (?, ?, 1, ?, ?) "
                "ON CONFLICT (person_id, text) DO UPDATE SET reads = reads + 1, last_read = excluded.last_read, "
                "last_right = excluded.last_right",
                (person_id, text, today, answer["right"]),
            )
