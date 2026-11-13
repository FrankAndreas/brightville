"""Her room's furniture (stage 8): sold on three shelves in the Möbelhaus, each piece on its own spot. The catalogue
is shared/furniture.json, the same file the page reads (src/core/furniture.ts). Ids are forever and never a clothes
id: the logbook and the parents' page look both catalogues up by id."""

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional

from . import outfits

DEFAULT_FILE = Path(__file__).resolve().parents[2] / "shared" / "furniture.json"
SPOTS = ("bild", "vorhang", "lampe", "bett", "teppich", "pflanze", "spielzeug")


@dataclass(frozen=True)
class Piece:
    id: str
    name: str
    emoji: str
    spot: str
    shelf: int
    price: int


@lru_cache
def catalogue() -> list[Piece]:
    with open(os.getenv("FURNITURE_FILE") or DEFAULT_FILE, encoding="utf-8") as file:
        return [Piece(p["id"], p["name"], p["emoji"], p["spot"], p["shelf"], p["price"]) for p in json.load(file)]


def piece(piece_id: str) -> Optional[Piece]:
    return next((p for p in catalogue() if p.id == piece_id), None)


def shelf_open(shelf: int, owned: Iterable[str]) -> bool:
    """Two pieces from the shelf above open the next; clothes don't count."""
    return outfits.shelf_open_in(catalogue(), shelf, owned)
