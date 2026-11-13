"""Stage 8 on the server: her room, placing furniture on its spots, buying it in the Möbelhaus (one purchase a day
across both shops, saved Stars counting half, furniture shelves of their own)."""

import sqlite3

from conftest import set_time

from app import db as database


def visit(browser, key, stars=10):
    return browser.post("/api/visits", json={"building": "school", "stars": stars, "key": key})


def learn(browser, day="d"):
    visit(browser, f"{day}-1")
    visit(browser, f"{day}-2")


def buy(browser, item, key=None):
    return browser.post("/api/moebel/buy", json={"item": item, "key": key or f"m-{item}"})


def set_money(stars, savings, person_id=2):
    with database.connect() as connection:
        connection.execute("UPDATE players SET stars = ?, savings = ? WHERE person_id = ?", (stars, savings, person_id))


def code(answer):
    return answer.json()["detail"]["code"]


def test_an_empty_room_until_something_is_bought(mia):
    assert mia.get("/api/room").json() == {"placed": {}, "owned": [], "bought_today": False}


def test_buying_places_the_piece_and_logs_it(mia):
    learn(mia)
    set_money(100, 0)
    answer = buy(mia, "holzbett").json()
    assert answer["state"]["stars"] == 75
    assert answer["room"]["placed"] == {"bett": "holzbett"}
    assert [o["id"] for o in answer["room"]["owned"]] == ["holzbett"]
    entry = mia.get("/api/logbook").json()[0]["entries"][-1]
    assert (entry["building"], entry["kind"], entry["stars"]) == ("holzbett", "buy", -25)


def test_one_purchase_a_day_across_both_shops(mia, monkeypatch):
    learn(mia)
    visit(mia, "d-3")
    assert mia.post("/api/shop/buy", json={"item": "schal", "key": "c1"}).status_code == 200
    answer = buy(mia, "kaktus")
    assert answer.status_code == 409 and code(answer) == "bought_today"
    assert mia.get("/api/room").json()["bought_today"] is True
    set_time(monkeypatch, "2026-11-13 10:00")
    learn(mia, "next")
    assert buy(mia, "kaktus").status_code == 200
    assert mia.get("/api/wardrobe").json()["bought_today"] is True
    answer = mia.post("/api/shop/buy", json={"item": "kappe", "key": "c2"})
    assert answer.status_code == 409 and code(answer) == "bought_today"


def test_furniture_shelves_ignore_clothes(mia, monkeypatch):
    for day, item, shop in (("12", "schal", "/api/shop/buy"), ("13", "kappe", "/api/shop/buy")):
        set_time(monkeypatch, f"2026-11-{day} 10:00")
        learn(mia, day)
        set_money(500, 0)
        assert mia.post(shop, json={"item": item, "key": f"k{day}"}).status_code == 200
    set_time(monkeypatch, "2026-11-14 10:00")
    learn(mia, "14")
    set_money(500, 0)
    answer = buy(mia, "einhornbild")
    assert answer.status_code == 409 and code(answer) == "shelf_locked"


def test_saved_stars_count_half_for_furniture_too(mia):
    learn(mia)
    set_money(90, 60)
    state = buy(mia, "kaktus").json()["state"]
    assert (state["stars"], state["savings"]) == (60, 30)


def test_swapping_pieces_on_a_spot(mia, monkeypatch):
    for day, item in (("12", "holzbett"), ("13", "sonnenbild"), ("14", "zeltbett")):
        set_time(monkeypatch, f"2026-11-{day} 10:00")
        learn(mia, day)
        set_money(500, 0)
        assert buy(mia, item, f"k{day}").status_code == 200
    assert mia.get("/api/room").json()["placed"]["bett"] == "zeltbett"
    placed = mia.put("/api/room/placed", json={"placed": {"bett": "holzbett"}}).json()["placed"]
    assert placed == {"bett": "holzbett", "bild": "sonnenbild"}
    placed = mia.put("/api/room/placed", json={"placed": {"bild": None}}).json()["placed"]
    assert placed == {"bett": "holzbett"}
    assert sorted(o["id"] for o in mia.get("/api/room").json()["owned"]) == ["holzbett", "sonnenbild", "zeltbett"]


def test_placed_must_be_owned_and_known(mia):
    learn(mia)
    buy(mia, "kaktus")
    # Not owned, on the wrong spot, unknown, an unknown spot: all left out
    for change in ({"bett": "burgbett"}, {"bett": "kaktus"}, {"pflanze": "gibtsnicht"}, {"dach": "kaktus"}):
        assert mia.put("/api/room/placed", json={"placed": change}).json()["placed"] == {"pflanze": "kaktus"}
    with database.connect() as connection:
        connection.execute("""UPDATE rooms SET placed = '{"pflanze": "kaktus", "bild": "weg"}' WHERE person_id = 2""")
        connection.execute(
            "INSERT INTO furniture (person_id, item_id, got_at) VALUES (2, 'weg', '2026-11-01T10:00:00')"
        )
    state = mia.get("/api/room").json()
    assert state["placed"] == {"pflanze": "kaktus"}
    assert [o["id"] for o in state["owned"]] == ["kaktus"]


def test_unknown_pieces_and_used_keys_buy_nothing(mia):
    learn(mia)
    assert buy(mia, "gibtsnicht").status_code == 404
    answer = buy(mia, "kaktus", key="d-1")
    assert answer.status_code == 409 and code(answer) == "key_used"
    assert buy(mia, "kaktus", key="same").status_code == 200
    again = buy(mia, "kaktus", key="same")
    assert again.status_code == 200 and again.json()["state"]["stars"] == 5


def test_play_time_used_up_does_not_close_the_moebelhaus(mia, papa):
    papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": 5})
    learn(mia)
    mia.post("/api/playtime", json={"seconds": 300})
    assert buy(mia, "kaktus").status_code == 200


def test_the_moebelhaus_waits_for_the_daily_goal(mia):
    visit(mia, "a")
    answer = buy(mia, "kaktus")
    assert answer.status_code == 409 and code(answer) == "locked"


def test_parents_see_her_furniture(mia, papa):
    learn(mia)
    buy(mia, "kaktus")
    row = next(r for r in papa.get("/api/players").json() if r["id"] == 2)
    assert row["furniture"] == ["kaktus"]


def test_migration_adds_the_tables(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    old = sqlite3.connect(tmp_path / "brightville.db")
    for step in database.MIGRATIONS[:7]:
        old.executescript(step)
    old.execute("PRAGMA user_version = 7")
    old.commit()
    old.close()
    connection = database.connect()
    tables = {r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"furniture", "rooms"} <= tables
    connection.close()
