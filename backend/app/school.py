"""The Lehrplan 21 ladders: the School's Zählen (MA.1.A.2) and Rechnen (MA.1.A.3), and the Reimhaus's Reimen (D.1.A.1).
The names say "school" for all of them. A ladder moves up one step when, of her last answered tasks at its step (two
visits' worth), no more than the ladder's allowed misses were wrong on the first try; it never moves down by itself.
Step 6 is "fertig". The page keeps the same rule (src/core/ladders.ts) to go on while the server is away; the server is
the truth."""

import json
import sqlite3
from datetime import date, timedelta
from typing import TypedDict

from . import clock
from .db import writing
from .game import Refused

WINDOW = {"zaehlen": 6, "rechnen": 4, "reimen": 10}
FIRST_STEP = 1
LAST_STEP = 6
MISSES_ALLOWED = {"zaehlen": 1, "rechnen": 1, "reimen": 2}
KEEP_KEYS_DAYS = 60
# How many of her latest result keys are named back: more than a device keeps waiting
SEEN_KEYS = 50


class Result(TypedDict):
    step: int
    results: list[bool]


def apply(step: int, recent: list[bool], results: list[bool], size: int, misses: int) -> tuple[int, list[bool]]:
    """Her new answers at `step`: the latest `size` are kept; enough of them with at most `misses` missed move her up"""
    if step >= LAST_STEP:
        return LAST_STEP, []
    kept = (recent + results)[-size:]
    if len(kept) >= size and kept.count(False) <= misses:
        return step + 1, []
    return step, kept


def _ladder(db: sqlite3.Connection, person_id: int, ladder: str) -> tuple[int, list[bool]]:
    row = db.execute(
        "SELECT step, recent FROM school_ladders WHERE person_id = ? AND ladder = ?", (person_id, ladder)
    ).fetchone()
    if row is None:
        # A child who used the School before the ladders has a Rechnen row from the migration (step 2)
        return FIRST_STEP, []
    return row["step"], json.loads(row["recent"])


def _store(db: sqlite3.Connection, person_id: int, ladder: str, step: int, recent: list[bool]) -> None:
    db.execute(
        "INSERT INTO school_ladders (person_id, ladder, step, recent) VALUES (?, ?, ?, ?) "
        "ON CONFLICT (person_id, ladder) DO UPDATE SET step = excluded.step, recent = excluded.recent",
        (person_id, ladder, step, json.dumps(recent)),
    )


def state(db: sqlite3.Connection, person_id: int) -> dict:
    """Her ladders, and the keys of her latest results the server has: a device lets those go even when the answer to
    sending them was lost"""
    out: dict = {}
    for ladder in WINDOW:
        step, recent = _ladder(db, person_id, ladder)
        out[ladder] = {"step": step, "window": recent}
    out["seen"] = [
        r["key"]
        for r in db.execute(
            "SELECT key FROM school_keys WHERE person_id = ? ORDER BY rowid DESC LIMIT ?", (person_id, SEEN_KEYS)
        )
    ]
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, results: dict[str, Result | None]) -> None:
    """One visit's answers, counted once (by its key), each ladder only if it was asked at the step it is at now"""
    forget = (date.fromisoformat(clock.today()) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM school_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        inserted = db.execute(
            "INSERT OR IGNORE INTO school_keys (person_id, key, day) VALUES (?, ?, ?)", (person_id, key, clock.today())
        )
        if inserted.rowcount != 1:
            return
        for ladder, size in WINDOW.items():
            result = results.get(ladder)
            if not result or not result["results"]:
                continue
            step, recent = _ladder(db, person_id, ladder)
            if result["step"] != step:
                continue
            _store(db, person_id, ladder, *apply(step, recent, result["results"], size, MISSES_ALLOWED[ladder]))


def set_step(db: sqlite3.Connection, person_id: int, ladder: str, step: int) -> None:
    """A parent puts a ladder at a step; her latest answers start over. Refused('unknown' | 'bad_step')"""
    if ladder not in WINDOW:
        raise Refused("unknown")
    if not FIRST_STEP <= step <= LAST_STEP:
        raise Refused("bad_step")
    with writing(db):
        _store(db, person_id, ladder, step, [])
