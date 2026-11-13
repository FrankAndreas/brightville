"""What the two shops share (stage 8): the Kleiderladen (wardrobe.py) and the Möbelhaus (room.py) sell by the same
rules, and one purchase a day counts across both. Learn first; play time is no reason to refuse; saved Stars pay two
for one (outfits.pay); a key so a purchase sent twice buys once."""

import sqlite3
from dataclasses import dataclass
from typing import Callable

from . import clock, game, outfits
from .db import writing


@dataclass
class Offer:
    """What a shop sells: found (or refused with unknown, not_for_sale, owned) inside the purchase's transaction"""

    item_id: str
    price: int
    shelf_ok: Callable[[], bool]
    record: Callable[[], None]


def bought_today(db: sqlite3.Connection, person_id: int) -> bool:
    """Anything bought today, in either shop"""
    row = db.execute(
        "SELECT 1 FROM events WHERE person_id = ? AND kind = 'buy' AND substr(at, 1, 10) = ?",
        (person_id, clock.today()),
    ).fetchone()
    return row is not None


def purchase(db: sqlite3.Connection, person_id: int, key: str, item_id: str, offer: Callable[[], Offer]) -> game.State:
    """Buys `item_id`, as `offer` finds it, all in one transaction. Refused (game.Refused) by the offer, then with
    locked, bought_today, shelf_locked, poor; key_used for a key that stands for something else (another day, another
    item, a visit). The same key today, for the same item, buys once. `record` writes what was bought (and puts it on
    or in place); the Stars are taken here."""
    with writing(db):
        now = game._row(db, person_id)
        seen = db.execute(
            "SELECT kind, building, at FROM events WHERE person_id = ? AND key = ?", (person_id, key)
        ).fetchone()
        if (
            seen is not None
            and seen["kind"] == "buy"
            and seen["building"] == item_id
            and seen["at"][:10] == clock.today()
        ):
            return now
        if seen is not None:
            raise game.Refused("key_used")
        found = offer()
        if not now.goal_reached():
            raise game.Refused("locked")
        if bought_today(db, person_id):
            raise game.Refused("bought_today")
        if not found.shelf_ok():
            raise game.Refused("shelf_locked")
        paid = outfits.pay(found.price, now.stars, now.savings)
        if paid is None:
            raise game.Refused("poor")
        taken = now.stars - paid[0]
        now.stars, now.savings = paid
        game._store(db, person_id, now)
        found.record()
        game._log(db, person_id, key, "buy", found.item_id, -taken)
        return now
