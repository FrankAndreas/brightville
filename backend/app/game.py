"""The rules that touch Stars: earning visits, rounds of play, play time, the daily numbers, the parent's settings."""

import math
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Optional

from . import clock
from .buildings import Building
from .db import writing


@dataclass
class State:
    stars: int
    day: str
    visits: int
    daily_goal: int
    play_seconds: int
    play_minutes: Optional[int]
    # Stars saved before the shop came (stage 7): they count half there, and never more than the Stars she has
    savings: int = 0

    def goal_reached(self) -> bool:
        return self.visits >= self.daily_goal

    def time_up(self) -> bool:
        return self.play_minutes is not None and self.play_seconds >= self.play_minutes * 60

    def as_dict(self) -> dict:
        return asdict(self)


class Refused(Exception):
    """A round that can't be bought right now; `code` says why: locked, time_up, poor, or key_used (the key of a
    visit or round from another day: each key stands for one thing for good)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class TooSoon(Exception):
    """An earning visit sooner after the one before than its Stars can be earned: the page keeps it and sends it
    again after `retry_after` seconds, so nothing is lost; Stars just can't be sent faster than a child earns them."""

    def __init__(self, retry_after: int):
        super().__init__(f"too soon, again in {retry_after} s")
        self.retry_after = retry_after


# Off only in tests whose clock stands still
COOLDOWN = True


def _row(db: sqlite3.Connection, person_id: int) -> State:
    """The player as of today: yesterday's visits and play time count for nothing."""
    row = db.execute("SELECT * FROM players WHERE person_id = ?", (person_id,)).fetchone()
    today = clock.today()
    if row is None:
        return State(0, today, 0, 2, 0, None)
    same_day = row["day"] == today
    return State(
        stars=row["stars"],
        day=today,
        visits=row["visits"] if same_day else 0,
        daily_goal=row["daily_goal"],
        play_seconds=row["play_seconds"] if same_day else 0,
        play_minutes=row["play_minutes"],
        savings=row["savings"],
    )


def _store(db: sqlite3.Connection, person_id: int, state: State) -> None:
    # Savings are part of the Stars: whatever takes Stars (a round, a parent's change) takes them down too
    state.savings = max(0, min(state.savings, state.stars))
    db.execute(
        "INSERT INTO players (person_id, stars, day, visits, play_seconds, daily_goal, play_minutes, savings)"
        " VALUES (:id, :stars, :day, :visits, :play_seconds, :daily_goal, :play_minutes, :savings)"
        " ON CONFLICT (person_id) DO UPDATE SET stars = :stars, day = :day, visits = :visits,"
        " play_seconds = :play_seconds, daily_goal = :daily_goal, play_minutes = :play_minutes, savings = :savings",
        {"id": person_id, **state.as_dict()},
    )


def _seen(db: sqlite3.Connection, person_id: int, key: str) -> bool:
    return db.execute("SELECT 1 FROM events WHERE person_id = ? AND key = ?", (person_id, key)).fetchone() is not None


def _seen_today(db: sqlite3.Connection, person_id: int, key: str) -> bool:
    """A round bought today under this key. A key from another day buys nothing: learn first, every day."""
    row = db.execute("SELECT at FROM events WHERE person_id = ? AND key = ?", (person_id, key)).fetchone()
    return row is not None and row["at"][:10] == clock.today()


def _log(db: sqlite3.Connection, person_id: int, key: str, kind: str, building: str, stars: int) -> None:
    # Never replaces: an entry, once written, stays (the callers check the key first)
    db.execute(
        "INSERT INTO events (person_id, key, kind, building, stars, at) VALUES (?, ?, ?, ?, ?, ?)",
        (person_id, key, kind, building, stars, clock.now().isoformat(timespec="seconds")),
    )


def _check_pace(db: sqlite3.Connection, person_id: int, building: Building, stars: int) -> None:
    """The cool-down: a child is in one building at a time, so an earning visit can't end sooner after the one before
    than its Stars take to earn (building.min_seconds_per_star). Measured with the server's clock, between the
    arrivals of the two visits, which is longer than the visit itself: generous to a child, not to a script."""
    if not COOLDOWN or building.min_seconds_per_star <= 0:
        return
    row = db.execute(
        "SELECT at FROM events WHERE person_id = ? AND kind = 'visit' ORDER BY at DESC LIMIT 1", (person_id,)
    ).fetchone()
    if row is None:
        return
    since = (clock.now() - datetime.fromisoformat(row["at"])).total_seconds()
    needed = stars * building.min_seconds_per_star
    if since < needed:
        raise TooSoon(max(1, math.ceil(needed - since)))


def state(db: sqlite3.Connection, person_id: int) -> State:
    return _row(db, person_id)


def visit(db: sqlite3.Connection, person_id: int, building: Building, stars: int, key: str) -> tuple[State, bool]:
    """An earning visit: at most what the building gives, and it counts only with Stars. Returns the new state and
    whether this visit reached today's goal. A key seen before changes nothing."""
    with writing(db):
        now = _row(db, person_id)
        earned = min(stars, building.max_stars)
        if earned <= 0 or _seen(db, person_id, key):
            return now, False
        _check_pace(db, person_id, building, earned)
        before = now.goal_reached()
        now.stars += earned
        now.visits += 1
        _store(db, person_id, now)
        _log(db, person_id, key, "visit", building.id, earned)
        reached = not before and now.goal_reached()
        if reached:
            # Kept with the goal of the day, so raising the goal later doesn't take the day back
            db.execute(
                "INSERT OR IGNORE INTO goal_days (person_id, day, goal) VALUES (?, ?, ?)",
                (person_id, now.day, now.daily_goal),
            )
        return now, reached


def free_visit(db: sqlite3.Connection, person_id: int, building: Building, key: str) -> None:
    """A visit to a free building: no Stars either way, only remembered for the logbook and the stickers."""
    with writing(db):
        if not _seen(db, person_id, key):
            _log(db, person_id, key, "free", building.id, 0)


def play(db: sqlite3.Connection, person_id: int, building: Building, key: str) -> State:
    """Buys one round. Learn first: never before today's goal; then the play time, then the price."""
    with writing(db):
        now = _row(db, person_id)
        # Sent again because the answer was lost: the round is bought already
        if _seen_today(db, person_id, key):
            return now
        if not now.goal_reached():
            raise Refused("locked")
        if now.time_up():
            raise Refused("time_up")
        if now.stars < building.cost:
            raise Refused("poor")
        # A key from another day (after the rules, so a page left open overnight still hears why the door is shut):
        # writing it would replace that day's entry, so it buys nothing
        if _seen(db, person_id, key):
            raise Refused("key_used")
        now.stars -= building.cost
        _store(db, person_id, now)
        _log(db, person_id, key, "play", building.id, -building.cost)
        return now


def add_play_time(db: sqlite3.Connection, person_id: int, seconds: int) -> State:
    with writing(db):
        now = _row(db, person_id)
        now.play_seconds += seconds
        _store(db, person_id, now)
        return now


def set_rules(
    db: sqlite3.Connection, person_id: int, daily_goal: int, play_minutes: Optional[int], stars: Optional[int]
) -> State:
    """A parent's settings; today's visits and play time stay as they are, and the Stars too when `stars` is None."""
    with writing(db):
        now = _row(db, person_id)
        now.daily_goal, now.play_minutes = daily_goal, play_minutes
        if stars is not None:
            now.stars = stars
        _store(db, person_id, now)
        return now
