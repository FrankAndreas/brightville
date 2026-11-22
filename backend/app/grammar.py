"""The Oberstufe's grammar (shared/grammar/<lang>.json): per child and topic `<lang>:<topic>`, his first answers of
the last 20 items (newest last) and the items he missed last time (so they come back first). An item's key is
`<lang>:<topic>:<id>`. The page picks the items of a round from this (src/core/grammar/round.ts); the server keeps the
record."""

import json
import sqlite3
from datetime import date, timedelta
from typing import TypedDict

from . import clock
from .db import writing
from .vocab import KEEP_KEYS_DAYS, LANGS, SEEN_KEYS

RECENT = 20
MISSED = 20


class Answer(TypedDict):
    item: str
    right: bool


def state(db: sqlite3.Connection, person_id: int, seen: bool = True) -> dict:
    """His record per topic, and the keys of his latest results the server has"""
    progress = {
        r["topic"]: {"recent": [bool(x) for x in json.loads(r["recent"])], "missed": json.loads(r["missed"])}
        for r in db.execute("SELECT topic, recent, missed FROM grammar_progress WHERE person_id = ?", (person_id,))
    }
    out: dict = {"progress": progress}
    if seen:
        out["seen"] = [
            r["key"]
            for r in db.execute(
                "SELECT key FROM grammar_keys WHERE person_id = ? ORDER BY rowid DESC LIMIT ?", (person_id, SEEN_KEYS)
            )
        ]
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, lang: str, answers: list[Answer]) -> None:
    """One round's first answers, counted once (by its key); an item of the other language, or not shaped
    `<lang>:<topic>:<id>`, is skipped"""
    today = clock.today()
    forget = (date.fromisoformat(today) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM grammar_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        inserted = db.execute(
            "INSERT OR IGNORE INTO grammar_keys (person_id, key, day) VALUES (?, ?, ?)", (person_id, key, today)
        )
        if inserted.rowcount != 1:
            return
        for answer in answers:
            item = answer["item"]
            parts = item.split(":", 2)
            if lang not in LANGS or len(parts) != 3 or parts[0] != lang or not parts[1] or not parts[2]:
                continue
            topic = f"{parts[0]}:{parts[1]}"
            row = db.execute(
                "SELECT recent, missed FROM grammar_progress WHERE person_id = ? AND topic = ?", (person_id, topic)
            ).fetchone()
            recent: list[bool] = [bool(x) for x in json.loads(row["recent"])] if row else []
            missed: list[str] = json.loads(row["missed"]) if row else []
            recent = (recent + [answer["right"]])[-RECENT:]
            missed = [m for m in missed if m != item]
            if not answer["right"]:
                missed = (missed + [item])[-MISSED:]
            db.execute(
                "INSERT INTO grammar_progress (person_id, topic, recent, missed) VALUES (?, ?, ?, ?) "
                "ON CONFLICT (person_id, topic) DO UPDATE SET recent = excluded.recent, missed = excluded.missed",
                (person_id, topic, json.dumps(recent), json.dumps(missed)),
            )
