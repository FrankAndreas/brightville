"""Her room (stage 8): the furniture she owns and what stands on each spot, and buying in the Möbelhaus (shop.py:
the Kleiderladen's rules, one purchase a day across both shops)."""

import json
import sqlite3
from typing import Optional

from . import clock, furniture, game, shop
from .db import writing


def _owned_rows(db: sqlite3.Connection, person_id: int) -> list[sqlite3.Row]:
    rows = db.execute(
        "SELECT item_id, got_at FROM furniture WHERE person_id = ? ORDER BY got_at, rowid", (person_id,)
    ).fetchall()
    # Only pieces the catalogue still has (an id that left it stays in the table, unused)
    return [r for r in rows if furniture.piece(r["item_id"]) is not None]


def owned_ids(db: sqlite3.Connection, person_id: int) -> list[str]:
    return [r["item_id"] for r in _owned_rows(db, person_id)]


def _stored(db: sqlite3.Connection, person_id: int) -> dict:
    """What was written down for her room; a value that isn't a JSON object (broken by hand) counts as an empty room"""
    row = db.execute("SELECT placed FROM rooms WHERE person_id = ?", (person_id,)).fetchone()
    try:
        stored = json.loads(row["placed"]) if row else {}
    except TypeError, ValueError:
        return {}
    return stored if isinstance(stored, dict) else {}


def _placed(db: sqlite3.Connection, person_id: int, mine: Optional[set[str]] = None) -> dict[str, str]:
    """What stands where: only owned, known pieces, each on its own spot. `mine`: her pieces, if already read"""
    if mine is None:
        mine = set(owned_ids(db, person_id))
    stored = _stored(db, person_id)
    return {
        spot: item_id
        for spot, item_id in stored.items()
        if isinstance(item_id, str)
        and item_id in mine
        and (p := furniture.piece(item_id)) is not None
        and p.spot == spot
    }


def _store(db: sqlite3.Connection, person_id: int, placed: dict[str, str]) -> None:
    db.execute(
        "INSERT INTO rooms (person_id, placed) VALUES (?, ?)"
        " ON CONFLICT (person_id) DO UPDATE SET placed = excluded.placed",
        (person_id, json.dumps(placed)),
    )


def state(db: sqlite3.Connection, person_id: int) -> dict:
    rows = _owned_rows(db, person_id)
    return {
        "placed": _placed(db, person_id, {r["item_id"] for r in rows}),
        "owned": [{"id": r["item_id"], "got_at": r["got_at"]} for r in rows],
        "bought_today": shop.bought_today(db, person_id),
    }


def place(db: sqlite3.Connection, person_id: int, changes: dict[str, Optional[str]]) -> None:
    """Puts a piece on its spot, or (None) takes it away, spot by spot. Only owned pieces, each on its own spot."""
    with writing(db):
        mine = set(owned_ids(db, person_id))
        placed = _placed(db, person_id, mine)
        for spot, item_id in changes.items():
            if spot not in furniture.SPOTS:
                continue
            if item_id is None:
                placed.pop(spot, None)
                continue
            p = furniture.piece(item_id)
            if p is not None and p.spot == spot and item_id in mine:
                placed[spot] = item_id
        _store(db, person_id, placed)


def buy(db: sqlite3.Connection, person_id: int, item_id: str, key: str) -> game.State:
    """Buys a piece in the Möbelhaus and puts it on its spot (what stood there stays hers). Refused with unknown,
    owned, then as shop.purchase."""

    def offer() -> shop.Offer:
        p = furniture.piece(item_id)
        if p is None:
            raise game.Refused("unknown")
        mine = owned_ids(db, person_id)
        if item_id in mine:
            raise game.Refused("owned")

        def record() -> None:
            db.execute(
                "INSERT INTO furniture (person_id, item_id, got_at) VALUES (?, ?, ?)",
                (person_id, item_id, clock.now().isoformat(timespec="seconds")),
            )
            placed = _placed(db, person_id)
            placed[p.spot] = item_id
            _store(db, person_id, placed)

        return shop.Offer(item_id, p.price, lambda: furniture.shelf_open(p.shelf, mine), record)

    return shop.purchase(db, person_id, key, item_id, offer)
