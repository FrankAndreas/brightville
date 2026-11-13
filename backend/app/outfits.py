"""The add-ons for a child's character: sold on three shelves in the Kleiderladen, or given with a sticker. The
catalogue is shared/outfits.json, the same file the page reads; the page has the same rules (src/core/outfits.ts)."""

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional

DEFAULT_FILE = Path(__file__).resolve().parents[2] / "shared" / "outfits.json"
PLACES = ("head", "neck", "body", "back")
# Owned add-ons from the shelf above needed to open a shelf
TO_OPEN = 2


@dataclass(frozen=True)
class Outfit:
    id: str
    name: str
    emoji: str
    place: str
    shelf: Optional[int] = None  # sold ones: 1, 2 or 3
    price: Optional[int] = None
    sticker: Optional[str] = None  # gifts: the sticker that brings it; never sold


@lru_cache
def catalogue() -> list[Outfit]:
    with open(os.getenv("OUTFITS_FILE") or DEFAULT_FILE, encoding="utf-8") as file:
        return [
            Outfit(o["id"], o["name"], o["emoji"], o["place"], o.get("shelf"), o.get("price"), o.get("sticker"))
            for o in json.load(file)
        ]


def outfit(outfit_id: str) -> Optional[Outfit]:
    return next((o for o in catalogue() if o.id == outfit_id), None)


def gift_for(sticker_id: str) -> Optional[Outfit]:
    return next((o for o in catalogue() if o.sticker == sticker_id), None)


def shelf_open(shelf: int, owned: Iterable[str]) -> bool:
    """Shelf 1 from the start; each further one once two add-ons from the shelf above are owned (gifts don't count)."""
    if shelf == 1:
        return True
    from_above = sum(1 for i in owned if (o := outfit(i)) is not None and o.shelf == shelf - 1)
    return from_above >= TO_OPEN


def shop_money(stars: int, savings: int) -> int:
    """What she can spend in the shop: saved Stars count half, Stars earned since count fully."""
    return savings // 2 + (stars - savings)


def pay(price: int, stars: int, savings: int) -> Optional[tuple[int, int]]:
    """Pays from the savings first, two saved Stars per price Star, the rest from Stars earned since. The new
    (stars, savings), or None when it isn't enough."""
    from_savings = min(savings // 2, price)
    rest = price - from_savings
    if rest > stars - savings:
        return None
    return stars - 2 * from_savings - rest, savings - 2 * from_savings
