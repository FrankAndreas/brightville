"""The furniture's rules on the server: the same cases as src/core/furniture.test.ts."""

from app import furniture, outfits

RANGES = {1: (15, 25), 2: (40, 60), 3: (90, 120)}


def test_every_piece_on_a_known_spot_priced_within_its_shelf_six_to_a_shelf():
    for p in furniture.catalogue():
        assert p.spot in furniture.SPOTS, p.id
        low, high = RANGES[p.shelf]
        assert low <= p.price <= high, p.id
    for shelf in (1, 2, 3):
        assert len([p for p in furniture.catalogue() if p.shelf == shelf]) == 6
    assert furniture.piece("holzbett").spot == "bett"
    assert furniture.piece("gibtsnicht") is None


def test_no_id_the_clothes_use():
    clothes = {o.id for o in outfits.catalogue()}
    assert not clothes & {p.id for p in furniture.catalogue()}


def test_shelves_open_with_two_from_above_and_clothes_do_not_count():
    assert furniture.shelf_open(1, [])
    assert not furniture.shelf_open(2, ["sonnenbild"])
    assert furniture.shelf_open(2, ["sonnenbild", "kaktus"])
    assert not furniture.shelf_open(2, ["sonnenbild", "schal"])
    assert furniture.shelf_open(3, ["sonnenbild", "kaktus", "einhornbild", "zeltbett"])
    assert not outfits.shelf_open(2, ["sonnenbild", "kaktus"])
