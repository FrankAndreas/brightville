"""Stickers: rare milestones a child works toward, and the logbook of what the child did, day by day.

Both are worked out from `events` (every earning visit, round bought and free visit, kept since stage 4) and
`goal_days`, so a child's history from before stickers existed counts too. The catalogue is shared/stickers.json,
the same file the page reads. An earned sticker is never taken back.
"""

import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Optional

from . import clock, game
from .db import writing

DEFAULT_FILE = Path(__file__).resolve().parents[2] / "shared" / "stickers.json"


@dataclass(frozen=True)
class Sticker:
    id: str
    emoji: str
    name: str
    says: str  # what it is for, said when tapped
    rule: dict


@lru_cache
def catalogue() -> list[Sticker]:
    with open(os.getenv("STICKERS_FILE") or DEFAULT_FILE, encoding="utf-8") as file:
        return [Sticker(s["id"], s["emoji"], s["name"], s["for"], s["rule"]) for s in json.load(file)]


@dataclass
class Facts:
    visits: dict[str, int]  # earning and free visits per building
    stars: int  # Stars earned in all
    different: int  # earning buildings visited at least once
    goal_days: int
    best_streak: int  # most days in a row with the goal reached


def _goal_days(db: sqlite3.Connection, person_id: int) -> set[str]:
    """Days the goal was reached: as recorded since stage 6, and for older days, by today's goal."""
    kept = {r["day"] for r in db.execute("SELECT day FROM goal_days WHERE person_id = ?", (person_id,))}
    goal = game.state(db, person_id).daily_goal
    counted = db.execute(
        "SELECT substr(at, 1, 10) AS day FROM events WHERE person_id = ? AND kind = 'visit'"
        " GROUP BY day HAVING COUNT(*) >= ?",
        (person_id, goal),
    )
    return kept | {r["day"] for r in counted}


def _best_streak(days: set[str]) -> int:
    best = run = 0
    previous: Optional[date] = None
    for day in sorted(date.fromisoformat(d) for d in days):
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return best


def facts(db: sqlite3.Connection, person_id: int) -> Facts:
    visits = {
        r["building"]: r["n"]
        for r in db.execute(
            "SELECT building, COUNT(*) AS n FROM events WHERE person_id = ? AND kind IN ('visit', 'free')"
            " GROUP BY building",
            (person_id,),
        )
    }
    row = db.execute(
        "SELECT COALESCE(SUM(stars), 0) AS stars, COUNT(DISTINCT building) AS different FROM events"
        " WHERE person_id = ? AND kind = 'visit'",
        (person_id,),
    ).fetchone()
    days = _goal_days(db, person_id)
    return Facts(visits, row["stars"], row["different"], len(days), _best_streak(days))


def earned(sticker: Sticker, f: Facts) -> bool:
    rule = sticker.rule
    if "visits" in rule:
        return sum(f.visits.get(b, 0) for b in rule["buildings"]) >= rule["visits"]
    if "different" in rule:
        return f.different >= rule["different"]
    if "streak" in rule:
        return f.best_streak >= rule["streak"]
    if "goalDays" in rule:
        return f.goal_days >= rule["goalDays"]
    if "stars" in rule:
        return f.stars >= rule["stars"]
    return False


def award(db: sqlite3.Connection, person_id: int) -> list[str]:
    """Gives every sticker the child has earned and doesn't have yet; returns the new ones, in catalogue order.
    Two requests at once can't give one twice: the table keeps one row per child and sticker."""
    with writing(db):
        have = {
            r["sticker_id"] for r in db.execute("SELECT sticker_id FROM stickers WHERE person_id = ?", (person_id,))
        }
        f = facts(db, person_id)
        at = clock.now().isoformat(timespec="seconds")
        new = []
        for sticker in catalogue():
            if sticker.id in have or not earned(sticker, f):
                continue
            added = db.execute(
                "INSERT OR IGNORE INTO stickers (person_id, sticker_id, earned_at) VALUES (?, ?, ?)",
                (person_id, sticker.id, at),
            )
            if added.rowcount:
                new.append(sticker.id)
        return new


def listing(db: sqlite3.Connection, person_id: int) -> list[dict]:
    rows = db.execute(
        "SELECT sticker_id, earned_at, seen FROM stickers WHERE person_id = ? ORDER BY earned_at, rowid", (person_id,)
    )
    return [{"id": r["sticker_id"], "earned_at": r["earned_at"], "seen": bool(r["seen"])} for r in rows]


def mark_seen(db: sqlite3.Connection, person_id: int, ids: list[str]) -> None:
    with writing(db):
        db.executemany(
            "UPDATE stickers SET seen = 1 WHERE person_id = ? AND sticker_id = ?", [(person_id, i) for i in ids]
        )


def logbook(db: sqlite3.Connection, person_id: int, before: Optional[str] = None, days: int = 7) -> list[dict]:
    """The days on which something happened, newest first, at most `days` of them and only before `before`.
    Times are as at home: an event's time was written with the home clock, so its first ten characters are its day."""
    pages: dict[str, dict] = {}

    def page(day: str) -> dict:
        return pages.setdefault(
            day, {"day": day, "goal_reached": False, "entries": [], "stickers": [], "paintings": []}
        )

    for r in db.execute(
        "SELECT building, kind, stars, at FROM events WHERE person_id = ? ORDER BY at, rowid", (person_id,)
    ):
        page(r["at"][:10])["entries"].append(
            {"building": r["building"], "kind": r["kind"], "stars": r["stars"], "at": r["at"][11:16]}
        )
    for s in listing(db, person_id):
        page(s["earned_at"][:10])["stickers"].append(s["id"])
    for p in db.execute(
        "SELECT id, updated FROM paintings WHERE person_id = ? ORDER BY updated", (person_id,)
    ).fetchall():
        day = datetime.fromtimestamp(p["updated"] / 1000, clock.zone()).strftime("%Y-%m-%d")
        page(day)["paintings"].append({"id": p["id"], "updated": p["updated"]})

    chosen = sorted((d for d in pages if before is None or d < before), reverse=True)[:days]
    reached = _goal_days(db, person_id)
    for d in chosen:
        pages[d]["goal_reached"] = d in reached
    return [pages[d] for d in chosen]
