"""What each building is: the same file the game's page reads (shared/buildings.json)."""

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DEFAULT_FILE = Path(__file__).resolve().parents[2] / "shared" / "buildings.json"


@dataclass(frozen=True)
class Building:
    id: str
    kind: str  # "earn" or "play"
    max_stars: int = 0  # the most one earning visit gives
    cost: int = 0  # Stars for one round of play


@lru_cache
def all_buildings() -> dict[str, Building]:
    with open(os.getenv("BUILDINGS_FILE") or DEFAULT_FILE, encoding="utf-8") as file:
        return {
            b["id"]: Building(b["id"], b["kind"], int(b.get("maxStars", 0)), int(b.get("cost", 0)))
            for b in json.load(file)
        }
