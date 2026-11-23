"""The Oberstufe's listening scenes (shared/listen/<lang>.json): per child and item key `<lang>:<topic>:<id>`, how
often he answered it right, the last day right (or None) and the last day asked. The page picks the scenes of a round
from this (src/core/listen/round.ts); the server only keeps the record."""

import sqlite3
from datetime import date, timedelta
from typing import TypedDict

from . import clock
from .db import writing
from .vocab import KEEP_KEYS_DAYS, LANGS, SEEN_KEYS


class Answer(TypedDict):
    item: str
    right: bool


def state(db: sqlite3.Connection, person_id: int, seen: bool = True) -> dict:
    """His record per item, and the keys of his latest results the server has"""
    progress = {
        r["item"]: {"right": r["right_count"], "last_right": r["last_right"], "last_asked": r["last_asked"]}
        for r in db.execute(
            "SELECT item, right_count, last_right, last_asked FROM speak_progress WHERE person_id = ?", (person_id,)
        )
    }
    out: dict = {"progress": progress}
    if seen:
        out["seen"] = [
            r["key"]
            for r in db.execute(
                "SELECT key FROM speak_keys WHERE person_id = ? ORDER BY rowid DESC LIMIT ?", (person_id, SEEN_KEYS)
            )
        ]
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, lang: str, answers: list[Answer]) -> None:
    """One round's answers, counted once (by its key); a item of the other language is skipped"""
    today = clock.today()
    forget = (date.fromisoformat(today) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM speak_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        inserted = db.execute(
            "INSERT OR IGNORE INTO speak_keys (person_id, key, day) VALUES (?, ?, ?)", (person_id, key, today)
        )
        if inserted.rowcount != 1:
            return
        for answer in answers:
            item = answer["item"]
            if lang not in LANGS or not item.startswith(f"{lang}:speak:"):
                continue
            right = 1 if answer["right"] else 0
            db.execute(
                "INSERT INTO speak_progress (person_id, item, right_count, last_right, last_asked) "
                "VALUES (?, ?, ?, ?, ?) ON CONFLICT (person_id, item) DO UPDATE SET "
                "right_count = right_count + excluded.right_count, "
                "last_right = COALESCE(excluded.last_right, last_right), last_asked = excluded.last_asked",
                (person_id, item, right, today if right else None, today),
            )
