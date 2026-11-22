"""The Oberstufe's vocabulary trainer: his own lists per language (English, French), and how well he knows each word
(a box from 0, new, to 5, and the day it is due again). A word's key is `<lang>:<topic>:<id>` for a built-in one
(shared/vocab/<lang>.json) and `<lang>:own:<its first foreign answer>` for one of his. The page keeps the same rules
(src/core/vocab/boxes.ts) to go on while the server is away; the server is the truth."""

import json
import os
import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import TypedDict

from . import clock
from .db import writing
from .game import Refused

LANGS = ("en", "fr")
MAX_LISTS = 30
MAX_WORDS = 60
MAX_SIDE = 60
MAX_NAME = 40
KEEP_KEYS_DAYS = 60
SEEN_KEYS = 50

_FILE = Path(__file__).resolve().parents[2] / "shared" / "vocab" / "boxes.json"
with open(os.getenv("VOCAB_BOXES_FILE") or _FILE, encoding="utf-8") as _file:
    _BOXES = json.load(_file)
# The days until a word is due again, by the box it moves into (1..5); staying in the last box takes the last entry
DAYS: list[int] = [int(d) for d in _BOXES["days"]]
MAX_BOX: int = int(_BOXES["maxBox"])


class Word(TypedDict):
    de: str
    foreign: str


class Answer(TypedDict):
    word: str
    right: bool


def next_box(box: int, right: bool, today: date) -> tuple[int, str]:
    """Right: one box up, due after that box's days (the last box stays, due after the longest). Wrong: box 1, due
    tomorrow."""
    if not right:
        return 1, (today + timedelta(days=DAYS[0])).isoformat()
    if box >= MAX_BOX:
        return MAX_BOX, (today + timedelta(days=DAYS[MAX_BOX])).isoformat()
    return box + 1, (today + timedelta(days=DAYS[box])).isoformat()


def check(lang: str, name: str, words: list[Word]) -> tuple[str, list[Word]]:
    """The list as it is kept (trimmed); Refused('bad-lang' | 'empty' | 'too-long')"""
    if lang not in LANGS:
        raise Refused("bad-lang")
    name = name.strip()
    kept = [Word(de=w["de"].strip(), foreign=w["foreign"].strip()) for w in words]
    if not name or not kept or any(not w["de"] or not w["foreign"] for w in kept):
        raise Refused("empty")
    if (
        len(name) > MAX_NAME
        or len(kept) > MAX_WORDS
        or any(len(w["de"]) > MAX_SIDE or len(w["foreign"]) > MAX_SIDE for w in kept)
    ):
        raise Refused("too-long")
    return name, kept


def _list(db: sqlite3.Connection, list_id: int) -> dict:
    row = db.execute("SELECT id, lang, name FROM vocab_lists WHERE id = ?", (list_id,)).fetchone()
    words = [
        {"de": w["de"], "foreign": w["foreign_"]}
        for w in db.execute("SELECT de, foreign_ FROM vocab_words WHERE list_id = ? ORDER BY position", (list_id,))
    ]
    return {"id": row["id"], "lang": row["lang"], "name": row["name"], "words": words}


def _owner(db: sqlite3.Connection, list_id: int) -> int | None:
    row = db.execute("SELECT person_id FROM vocab_lists WHERE id = ?", (list_id,)).fetchone()
    return None if row is None else int(row["person_id"])


def _write_words(db: sqlite3.Connection, list_id: int, words: list[Word]) -> None:
    db.execute("DELETE FROM vocab_words WHERE list_id = ?", (list_id,))
    db.executemany(
        "INSERT INTO vocab_words (list_id, position, de, foreign_) VALUES (?, ?, ?, ?)",
        [(list_id, i, w["de"], w["foreign"]) for i, w in enumerate(words)],
    )


def create(db: sqlite3.Connection, person_id: int, lang: str, name: str, words: list[Word]) -> dict:
    """A new list; Refused('too-many') past MAX_LISTS in that language, and as `check`"""
    name, words = check(lang, name, words)
    with writing(db):
        count = db.execute(
            "SELECT COUNT(*) FROM vocab_lists WHERE person_id = ? AND lang = ?", (person_id, lang)
        ).fetchone()[0]
        if count >= MAX_LISTS:
            raise Refused("too-many")
        cursor = db.execute("INSERT INTO vocab_lists (person_id, lang, name) VALUES (?, ?, ?)", (person_id, lang, name))
        list_id = int(cursor.lastrowid or 0)
        _write_words(db, list_id, words)
    return _list(db, list_id)


def update(db: sqlite3.Connection, person_id: int, list_id: int, lang: str, name: str, words: list[Word]) -> dict:
    """Changes one of his lists; Refused('unknown') for a list that isn't his, and as `create`"""
    name, words = check(lang, name, words)
    with writing(db):
        if _owner(db, list_id) != person_id:
            raise Refused("unknown")
        old = db.execute("SELECT lang FROM vocab_lists WHERE id = ?", (list_id,)).fetchone()["lang"]
        if old != lang:
            count = db.execute(
                "SELECT COUNT(*) FROM vocab_lists WHERE person_id = ? AND lang = ?", (person_id, lang)
            ).fetchone()[0]
            if count >= MAX_LISTS:
                raise Refused("too-many")
        db.execute("UPDATE vocab_lists SET lang = ?, name = ? WHERE id = ?", (lang, name, list_id))
        _write_words(db, list_id, words)
    return _list(db, list_id)


def delete(db: sqlite3.Connection, person_id: int, list_id: int) -> None:
    """Deletes one of his lists (how well he knows its words is kept); Refused('unknown')"""
    with writing(db):
        if _owner(db, list_id) != person_id:
            raise Refused("unknown")
        db.execute("DELETE FROM vocab_words WHERE list_id = ?", (list_id,))
        db.execute("DELETE FROM vocab_lists WHERE id = ?", (list_id,))


def state(db: sqlite3.Connection, person_id: int, seen: bool = True) -> dict:
    """His lists (in the order made), how well he knows each word, and the keys of his latest results the server has"""
    lists = [
        _list(db, r["id"])
        for r in db.execute("SELECT id FROM vocab_lists WHERE person_id = ? ORDER BY id", (person_id,))
    ]
    progress = {
        r["word"]: {"box": r["box"], "due": r["due"]}
        for r in db.execute("SELECT word, box, due FROM vocab_progress WHERE person_id = ?", (person_id,))
    }
    out: dict = {"lists": lists, "progress": progress}
    if seen:
        out["seen"] = [
            r["key"]
            for r in db.execute(
                "SELECT key FROM vocab_keys WHERE person_id = ? ORDER BY rowid DESC LIMIT ?", (person_id, SEEN_KEYS)
            )
        ]
    return out


def record(db: sqlite3.Connection, person_id: int, key: str, lang: str, answers: list[Answer]) -> None:
    """One round's first answers, counted once (by its key); a word of the other language is skipped"""
    today = date.fromisoformat(clock.today())
    forget = (today - timedelta(days=KEEP_KEYS_DAYS)).isoformat()
    with writing(db):
        db.execute("DELETE FROM vocab_keys WHERE person_id = ? AND day < ?", (person_id, forget))
        inserted = db.execute(
            "INSERT OR IGNORE INTO vocab_keys (person_id, key, day) VALUES (?, ?, ?)",
            (person_id, key, today.isoformat()),
        )
        if inserted.rowcount != 1:
            return
        for answer in answers:
            word = answer["word"]
            if lang not in LANGS or not word.startswith(f"{lang}:"):
                continue
            row = db.execute(
                "SELECT box FROM vocab_progress WHERE person_id = ? AND word = ?", (person_id, word)
            ).fetchone()
            box, due = next_box(row["box"] if row else 0, answer["right"], today)
            db.execute(
                "INSERT INTO vocab_progress (person_id, word, box, due) VALUES (?, ?, ?, ?) "
                "ON CONFLICT (person_id, word) DO UPDATE SET box = excluded.box, due = excluded.due",
                (person_id, word, box, due),
            )
