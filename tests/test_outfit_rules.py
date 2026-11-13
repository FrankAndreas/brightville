"""The shop's rules on the server: the same cases as src/core/outfits.test.ts, so page and server agree."""

import json
from pathlib import Path

from app import outfits

RANGES = {1: (15, 25), 2: (40, 60), 3: (90, 120)}
STICKERS = Path(__file__).resolve().parents[1] / "shared" / "stickers.json"


def test_prices_within_each_shelf_and_gifts_for_existing_stickers():
    sticker_ids = {s["id"] for s in json.loads(STICKERS.read_text(encoding="utf-8"))}
    for o in outfits.catalogue():
        assert o.place in outfits.PLACES, o.id
        if o.sticker:
            assert o.sticker in sticker_ids and o.price is None and o.shelf is None, o.id
        else:
            low, high = RANGES[o.shelf]
            assert low <= o.price <= high, o.id
    assert len([o for o in outfits.catalogue() if not o.sticker]) == 15
    assert outfits.gift_for("sternensammler").id == "glitzerband"
    assert outfits.outfit("gibtsnicht") is None


def test_a_shelf_opens_with_two_from_the_shelf_above_and_gifts_do_not_count():
    assert outfits.shelf_open(1, [])
    assert not outfits.shelf_open(2, ["schleife"])
    assert outfits.shelf_open(2, ["schleife", "kappe"])
    assert not outfits.shelf_open(2, ["schleife", "glitzerband"])
    assert not outfits.shelf_open(3, ["schleife", "kappe"])
    assert outfits.shelf_open(3, ["schleife", "kappe", "kleid", "umhang"])


def test_saved_stars_count_half():
    assert outfits.shop_money(90, 60) == 60
    assert outfits.shop_money(10, 0) == 10
    assert outfits.shop_money(1, 1) == 0


def test_paying_takes_savings_first_two_for_one():
    assert outfits.pay(20, 90, 60) == (50, 20)
    assert outfits.pay(20, 21, 1) == (1, 1)
    assert outfits.pay(20, 19, 0) is None
    assert outfits.pay(100, 150, 150) is None
    assert outfits.pay(20, 40, 30) == (5, 0)
