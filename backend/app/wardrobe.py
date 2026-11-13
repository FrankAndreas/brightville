"""A child's character (stage 7): her look, the add-ons she owns and wears, and buying in the Kleiderladen.

Buying follows "learn first" like a round of play, but play time is no reason to refuse: the shop isn't a game.
One add-on a day; saved Stars count half (outfits.pay). Gifts come with stickers (give_gifts)."""

import json
import sqlite3
from typing import Optional

from . import clock, game, outfits, shop
from .db import writing

# The same lists as src/core/look.ts: a look with anything else is refused
LOOK_OPTIONS: dict[str, list[str]] = {
    "body": ["#ff9a3c", "#4f8fe8", "#4bd37b", "#e86fb0", "#a58bf0", "#f2c230", "#3cc8c8", "#ff6b6b"],
    "hair": ["none", "spiky", "ponytail", "buns", "curly"],
    "hairColor": ["#6b3b1f", "#222222", "#f2c94c", "#d4572a", "#4f8fe8", "#ff8fc8"],
    "glasses": ["none", "round", "star", "heart"],
}


class BadLook(ValueError):
    pass


def _is_look(look: object) -> bool:
    return (
        isinstance(look, dict)
        and set(look) == set(LOOK_OPTIONS)
        and all(look[k] in options for k, options in LOOK_OPTIONS.items())
    )


def _row(db: sqlite3.Connection, person_id: int) -> tuple[Optional[dict], dict[str, str]]:
    row = db.execute("SELECT look, worn FROM looks WHERE person_id = ?", (person_id,)).fetchone()
    if row is None:
        return None, {}
    # Only add-ons the catalogue still has, each in its own place: a renamed or removed id breaks no screen
    worn = {
        place: item_id
        for place, item_id in json.loads(row["worn"]).items()
        if (o := outfits.outfit(item_id)) is not None and o.place == place
    }
    return json.loads(row["look"]), worn


def _store(db: sqlite3.Connection, person_id: int, look: Optional[dict], worn: dict[str, str]) -> None:
    db.execute(
        "INSERT INTO looks (person_id, look, worn) VALUES (?, ?, ?)"
        " ON CONFLICT (person_id) DO UPDATE SET look = excluded.look, worn = excluded.worn",
        (person_id, json.dumps(look), json.dumps(worn)),
    )


def owned_ids(db: sqlite3.Connection, person_id: int) -> list[str]:
    """Her add-ons the catalogue still has (kept by id: an id that left it stays in the table, unused)"""
    rows = db.execute("SELECT item_id FROM outfits WHERE person_id = ? ORDER BY got_at, rowid", (person_id,))
    return [r["item_id"] for r in rows if outfits.outfit(r["item_id"]) is not None]


def state(db: sqlite3.Connection, person_id: int) -> dict:
    look, worn = _row(db, person_id)
    rows = db.execute(
        "SELECT item_id, how, got_at FROM outfits WHERE person_id = ? ORDER BY got_at, rowid", (person_id,)
    ).fetchall()
    return {
        "look": look,
        "worn": worn,
        "owned": [
            {"id": r["item_id"], "how": r["how"], "got_at": r["got_at"]} for r in rows if outfits.outfit(r["item_id"])
        ],
        "bought_today": shop.bought_today(db, person_id),
    }


def save_look(db: sqlite3.Connection, person_id: int, look: object) -> None:
    if not _is_look(look):
        raise BadLook("bad_look")
    with writing(db):
        _, worn = _row(db, person_id)
        _store(db, person_id, dict(look), worn)  # type: ignore[call-overload]


def wear(db: sqlite3.Connection, person_id: int, changes: dict[str, Optional[str]]) -> None:
    """Puts on or (None) takes off, place by place. Only known places, owned add-ons, each in its own place."""
    with writing(db):
        look, worn = _row(db, person_id)
        mine = set(owned_ids(db, person_id))
        for place, item_id in changes.items():
            if place not in outfits.PLACES:
                continue
            if item_id is None:
                worn.pop(place, None)
                continue
            item = outfits.outfit(item_id)
            if item is not None and item.place == place and item_id in mine:
                worn[place] = item_id
        _store(db, person_id, look, worn)


def buy(db: sqlite3.Connection, person_id: int, item_id: str, key: str) -> game.State:
    """Buys one add-on and puts it on. Refused (game.Refused) with: unknown, not_for_sale, owned, then as
    shop.purchase (locked, bought_today, shelf_locked, poor, key_used). The same key today buys once."""

    def offer() -> shop.Offer:
        item = outfits.outfit(item_id)
        if item is None:
            raise game.Refused("unknown")
        if item.price is None or item.shelf is None:
            raise game.Refused("not_for_sale")
        mine = owned_ids(db, person_id)
        if item_id in mine:
            raise game.Refused("owned")
        shelf, place = item.shelf, item.place

        def record() -> None:
            db.execute(
                "INSERT INTO outfits (person_id, item_id, how, got_at) VALUES (?, ?, 'bought', ?)",
                (person_id, item_id, clock.now().isoformat(timespec="seconds")),
            )
            look, worn = _row(db, person_id)
            worn[place] = item_id
            _store(db, person_id, look, worn)

        return shop.Offer(item_id, item.price, lambda: outfits.shelf_open(shelf, mine), record)

    return shop.purchase(db, person_id, key, item_id, offer)


def give_gifts(db: sqlite3.Connection, person_id: int) -> list[str]:
    """The add-ons that come with the stickers she has and doesn't own yet. Asked often: writes only when due."""
    have = {r["sticker_id"] for r in db.execute("SELECT sticker_id FROM stickers WHERE person_id = ?", (person_id,))}
    mine = set(owned_ids(db, person_id))
    due = [g.id for s in have if (g := outfits.gift_for(s)) is not None and g.id not in mine]
    if not due:
        return []
    at = clock.now().isoformat(timespec="seconds")
    with writing(db):
        for item_id in due:
            db.execute(
                "INSERT OR IGNORE INTO outfits (person_id, item_id, how, got_at) VALUES (?, ?, 'gift', ?)",
                (person_id, item_id, at),
            )
    return sorted(due)
