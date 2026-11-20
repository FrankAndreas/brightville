"""The School's two Lehrplan 21 ladders, Zählen (MA.1.A.2) and Rechnen (MA.1.A.3). A ladder moves up one step when, of
her last answered tasks at its step (two visits' worth), at most one was missed on the first try; it never moves down
by itself. Step 6 is "fertig". The page keeps the same rule (src/core/ladders.ts) to go on while the server is away; the
server is the truth."""

import json
import sqlite3
from datetime import date, timedelta
from typing import TypedDict

from . import clock
from .db import writing
from .game import Refused

WINDOW = {"zaehlen": 6, "rechnen": 4}
FIRST_STEP = 1
LAST_STEP = 6
MISSES_ALLOWED = 1
KEEP_KEYS_DAYS = 60


class Result(TypedDict):
    step: int
    results: list[bool]


def apply(step: int, recent: list[bool], results: list[bool], size: int) -> tuple[int, list[bool]]:
    """Her new answers at `step`: the latest `size` are kept; enough of them with at most one miss move her up"""
    if step >= LAST_STEP:
        return LAST_STEP, []
    kept = (recent + results)[-size:]
    if len(kept) >= size and kept.count(False) <= MISSES_ALLOWED:
        return step + 1, []
    return step, kept


def _start(db: sqlite3.Connection, person_id: int, ladder: str) -> int:
    """Rechnen starts at 2 for a child who used the old School (sums up to 9); everything else at 1"""
    if ladder != "rechnen":
        return FIRST_STEP
    used = db.execute(
        "SELECT 1 FROM events WHERE person_id = ? AND building = 'school' LIMIT 1", (person_id,)
    ).fetchone()
    return 2 if used else FIRST_STEP


def _ladder(db: sqlite3.Connection, person_id: int, ladder: str) -> tuple[int, list[bool]]:
    row = db.execute(
        "SELECT step, recent FROM school_ladders WHERE person_id = ? AND ladder = ?", (person_id, ladder)
    ).fetchone()
    if row is None:
        return _start(db, person_id, ladder), []
    return row["step"], json.loads(row["recent"])


def _store(db: sqlite3.Connection, person_id: int, ladder: str, step: int, recent: list[bool]) -> None:
    db.execute(
        "INSERT INTO school_ladders (person_id, ladder, step, recent) VALUES (?, ?, ?, ?) "
        "ON CONFLICT (person_id, ladder) DO UPDATE SET step = excluded.step, recent = excluded.recent",
        (person_id, ladder, step, json.dumps(recent)),
    )


def state(db: sqlite3.Connection, person_id: int) -> dict:
    out = {}
    for ladder in WINDOW:
        step, recent = _ladder(db, person_id, ladder)
        out[ladder] = {"step": step, "window": recent}
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, results: dict[str, Result]) -> None:
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
            _store(db, person_id, ladder, *apply(step, recent, result["results"], size))


def set_step(db: sqlite3.Connection, person_id: int, ladder: str, step: int) -> None:
    """A parent puts a ladder at a step; her latest answers start over. Refused('unknown' | 'bad_step')"""
    if ladder not in WINDOW:
        raise Refused("unknown")
    if not FIRST_STEP <= step <= LAST_STEP:
        raise Refused("bad_step")
    with writing(db):
        _store(db, person_id, ladder, step, [])
