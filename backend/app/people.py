"""The copy of who may play: refreshed from the hub (or LOCAL_PEOPLE), never deleted from, so Stars survive someone
being taken out of the app and put back."""

import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Optional, Protocol

from . import game
from .db import writing


class PersonLike(Protocol):
    @property
    def id(self) -> int: ...
    @property
    def name(self) -> str: ...
    @property
    def role(self) -> str: ...
    @property
    def color(self) -> Optional[str]: ...


@dataclass(frozen=True)
class Person:
    id: int
    name: str
    role: str
    color: Optional[str]

    @classmethod
    def of(cls, other: PersonLike) -> "Person":
        return cls(other.id, other.name, other.role, other.color)

    def is_parent(self) -> bool:
        return self.role == "PARENT"


UPSERT = (
    "INSERT INTO people (id, name, role, color, active) VALUES (?, ?, ?, ?, 1)"
    " ON CONFLICT (id) DO UPDATE SET name = excluded.name, role = excluded.role, color = excluded.color, active = 1"
)


def remember(db: sqlite3.Connection, person: Person) -> None:
    """Notes the person who just came in, when they are new here or changed in the hub."""
    row = db.execute("SELECT name, role, color, active FROM people WHERE id = ?", (person.id,)).fetchone()
    if row is None or tuple(row) != (person.name, person.role, person.color, 1):
        with writing(db):
            db.execute(UPSERT, (person.id, person.name, person.role, person.color))


def replace_all(db: sqlite3.Connection, everyone: Iterable[Person]) -> None:
    """Everyone who may play right now; the others are hidden and keep their Stars."""
    with writing(db):
        db.execute("UPDATE people SET active = 0")
        for person in everyone:
            db.execute(UPSERT, (person.id, person.name, person.role, person.color))


def is_active(db: sqlite3.Connection, person_id: int) -> bool:
    return db.execute("SELECT 1 FROM people WHERE id = ? AND active = 1", (person_id,)).fetchone() is not None


def listing(db: sqlite3.Connection) -> list[dict]:
    """Everyone who may play with their numbers of today: children first, then by name."""
    rows = db.execute(
        "SELECT id, name, role, color FROM people WHERE active = 1 ORDER BY role = 'PARENT', name COLLATE NOCASE"
    ).fetchall()
    return [{**dict(row), **game.state(db, row["id"]).as_dict()} for row in rows]
