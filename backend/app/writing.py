"""Schreiben: her words and sentences (written by the parents), how well she knows each letter, and how many new
letters she may meet today. The page keeps the same rules (src/core/writing/levels.ts) to go on while the server is
away; the server is the truth."""

import re
import sqlite3
import unicodedata
from datetime import date, timedelta
from typing import Optional, TypedDict

from . import clock
from .db import writing
from .game import Refused

# The capitals, umlauts and digits of the Basisschrift (src/core/writing/basisschrift.json)
GLYPHS = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789")
MAX_TEXT = 30
MAX_TEXTS = 20
# 1 the full letter, 2 dots, 3 only the start dot, 4 known (no help); a letter not introduced has no row
FIRST_LEVEL = 1
KNOWN = 4
# Three in a row, up or down
STREAK = 3
NEW_A_DAY = 2
# A write's key is kept this long: a device away from the server longer sends nothing anyone remembers
KEEP_KEYS_DAYS = 60


class Write(TypedDict):
    key: str
    glyph: str
    level: int
    clean: bool


def normalize(text: str) -> str:
    """Capitals, single spaces, nothing around. NFKC first: an umlaut pasted as letter + mark becomes one letter, "ﬁ"
    two, full-width ＭＩＡ plain MIA"""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip().upper()


def check(texts: list[str]) -> list[str]:
    """The texts as they are kept; Refused('empty' | 'letters' | 'too-long' | 'exists' | 'too-many')"""
    if len(texts) > MAX_TEXTS:
        raise Refused("too-many")
    out: list[str] = []
    for raw in texts:
        text = normalize(raw)
        if not text:
            raise Refused("empty")
        # "ß".upper() is "SS": a word the parents typed must not change its spelling unseen
        if "ß" in raw or not all(c in GLYPHS or c == " " for c in text):
            raise Refused("letters")
        if len(text) > MAX_TEXT:
            raise Refused("too-long")
        if text in out:
            raise Refused("exists")
        out.append(text)
    return out


def set_texts(db: sqlite3.Connection, person_id: int, texts: list[str]) -> None:
    kept = check(texts)
    with writing(db):
        db.execute("DELETE FROM writing_texts WHERE person_id = ?", (person_id,))
        db.executemany(
            "INSERT INTO writing_texts (person_id, position, text) VALUES (?, ?, ?)",
            [(person_id, i, t) for i, t in enumerate(kept)],
        )


def new_left_today(db: sqlite3.Connection, person_id: int, day: Optional[str] = None) -> int:
    """Two new letters a day; one while three or more sit at the first level, none while five or more do. The day's
    pace is set by the letters from before it, so the round's first new letter doesn't take its second's place.
    `day`: another day than today, for a letter met on the device while the server was away. Its letters at level 1
    are counted as they are now, not as they were that day: it errs towards one more new letter, never one fewer."""
    day = day or clock.today()
    weak = db.execute(
        "SELECT COUNT(*) FROM writing_letters WHERE person_id = ? AND level = ? AND introduced_on < ?",
        (person_id, FIRST_LEVEL, day),
    ).fetchone()[0]
    base = 0 if weak >= 5 else 1 if weak >= 3 else NEW_A_DAY
    met = db.execute(
        "SELECT COUNT(*) FROM writing_letters WHERE person_id = ? AND introduced_on = ?", (person_id, day)
    ).fetchone()[0]
    return int(max(0, base - met))


def state(db: sqlite3.Connection, person_id: int) -> dict:
    texts = [
        r["text"]
        for r in db.execute("SELECT text FROM writing_texts WHERE person_id = ? ORDER BY position", (person_id,))
    ]
    letters = {
        r["glyph"]: {"level": r["level"], "streak": r["streak"], "practised_at": r["practised_at"]}
        for r in db.execute(
            "SELECT glyph, level, streak, practised_at FROM writing_letters WHERE person_id = ? ORDER BY glyph",
            (person_id,),
        )
    }
    return {"texts": texts, "letters": letters, "new_left_today": new_left_today(db, person_id)}


def _first_time(db: sqlite3.Connection, person_id: int, key: str) -> bool:
    inserted = db.execute(
        "INSERT OR IGNORE INTO writing_keys (person_id, key, day) VALUES (?, ?, ?)", (person_id, key, clock.today())
    )
    return inserted.rowcount == 1


def _the_day(day: Optional[str]) -> str:
    """The day a new letter was met on the device: today when not given, not a date, later than today, or further back
    than a write's key is kept (a device clock reset to an old date would put every new letter on one day)"""
    today = clock.today()
    earliest = (date.fromisoformat(today) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    try:
        on = date.fromisoformat(day).isoformat() if day else today
    except ValueError:
        return today
    return on if earliest <= on <= today else today


def introduce(db: sqlite3.Connection, person_id: int, glyph: str, day: Optional[str] = None) -> None:
    """She wrote a new letter three times (on `day`, if the device kept it while the server was away): it is at the
    first level now. Refused('unknown' | 'no_new_today'). Meeting a letter twice is meeting it once: no key needed."""
    if glyph not in GLYPHS:
        raise Refused("unknown")
    with writing(db):
        known = db.execute(
            "SELECT 1 FROM writing_letters WHERE person_id = ? AND glyph = ?", (person_id, glyph)
        ).fetchone()
        if known:
            return
        on = _the_day(day)
        if new_left_today(db, person_id, on) <= 0:
            raise Refused("no_new_today")
        db.execute(
            "INSERT INTO writing_letters (person_id, glyph, level, streak, introduced_on) VALUES (?, ?, ?, 0, ?)",
            (person_id, glyph, FIRST_LEVEL, on),
        )


def apply(level: int, streak: int, clean: bool) -> tuple[int, int]:
    """One write: three clean in a row up a level, three bumpy down one; the other kind starts the count again"""
    streak = max(streak, 0) + 1 if clean else min(streak, 0) - 1
    if streak >= STREAK:
        return min(level + 1, KNOWN), 0
    if streak <= -STREAK:
        return max(level - 1, FIRST_LEVEL), 0
    return level, streak


def record(db: sqlite3.Connection, person_id: int, writes: list[Write]) -> None:
    """Counts each write once (by its key), and only one shown at the letter's level now"""
    at = clock.now().isoformat(timespec="seconds")
    forget = (date.fromisoformat(clock.today()) - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM writing_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        for w in writes:
            row = db.execute(
                "SELECT level, streak FROM writing_letters WHERE person_id = ? AND glyph = ?", (person_id, w["glyph"])
            ).fetchone()
            if row is None or row["level"] != w["level"] or not _first_time(db, person_id, w["key"]):
                continue
            level, streak = apply(row["level"], row["streak"], w["clean"])
            db.execute(
                "UPDATE writing_letters SET level = ?, streak = ?, practised_at = ? WHERE person_id = ? AND glyph = ?",
                (level, streak, at, person_id, w["glyph"]),
            )
