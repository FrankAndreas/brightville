"""The add-ons for a child's character: sold on three shelves in the Kleiderladen, or given with a sticker. The
catalogue is shared/outfits.json, the same file the page reads; the page has the same rules (src/core/outfits.ts)."""

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Optional

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


def shelf_open_in(items: Iterable[Any], shelf: int, owned: Iterable[str]) -> bool:
    """The shops' shelf rule, for any catalogue (things with `id` and `shelf`): shelf 1 from the start, each further
    one once two of the catalogue's things from the shelf above are owned. Other catalogues and gifts don't count."""
    if shelf == 1:
        return True
    shelf_of = {i.id: i.shelf for i in items}
    return sum(1 for i in owned if shelf_of.get(i) == shelf - 1) >= TO_OPEN


def shelf_open(shelf: int, owned: Iterable[str]) -> bool:
    """The clothes' shelves (gifts don't count)."""
    return shelf_open_in(catalogue(), shelf, owned)


def _paired(savings: int) -> int:
    """Savings count in pairs: a lone saved Star left over counts like a new one, so it isn't worth nothing for good."""
    return savings - savings % 2


def shop_money(stars: int, savings: int) -> int:
    """What she can spend in the shop: saved Stars count half, Stars earned since count fully."""
    saved = _paired(savings)
    return saved // 2 + (stars - saved)


def pay(price: int, stars: int, savings: int) -> Optional[tuple[int, int]]:
    """Pays from the savings first, two saved Stars per price Star, the rest from Stars earned since. The new
    (stars, savings), or None when it isn't enough."""
    saved = _paired(savings)
    from_savings = min(saved // 2, price)
    rest = price - from_savings
    if rest > stars - saved:
        return None
    return stars - 2 * from_savings - rest, saved - 2 * from_savings
