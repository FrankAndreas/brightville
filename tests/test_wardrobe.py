"""Stage 7 on the server: her look, what she owns and wears, buying in the Kleiderladen (one a day, saved Stars
counting half) and the gifts that come with stickers."""

import sqlite3
import threading

from conftest import set_time

from app import db as database
from app import game, wardrobe

LOOK = {"body": "#4f8fe8", "hair": "buns", "hairColor": "#6b3b1f", "glasses": "round"}


def visit(browser, key, stars=10, building="school"):
    return browser.post("/api/visits", json={"building": building, "stars": stars, "key": key})


def learn(browser, day="d"):
    """Today's two learning visits: the shop's door opens"""
    visit(browser, f"{day}-1")
    visit(browser, f"{day}-2")


def buy(browser, item, key=None):
    return browser.post("/api/shop/buy", json={"item": item, "key": key or f"buy-{item}"})


def set_money(stars, savings, person_id=2):
    with database.connect() as connection:
        connection.execute("UPDATE players SET stars = ?, savings = ? WHERE person_id = ?", (stars, savings, person_id))


def owned(browser):
    return sorted(o["id"] for o in browser.get("/api/wardrobe").json()["owned"])


def code(answer):
    return answer.json()["detail"]["code"]


def test_no_look_until_saved_then_kept(mia):
    assert mia.get("/api/wardrobe").json() == {"look": None, "worn": {}, "owned": [], "bought_today": False}
    assert mia.put("/api/look", json={"look": LOOK}).status_code == 200
    assert mia.get("/api/wardrobe").json()["look"] == LOOK
    answer = mia.put("/api/look", json={"look": {**LOOK, "hair": "mohawk"}})
    assert answer.status_code == 422 and code(answer) == "bad_look"


def test_the_look_options_match_the_page():
    # The same lists as src/core/look.ts
    assert wardrobe.LOOK_OPTIONS["hair"] == ["none", "spiky", "ponytail", "buns", "curly"]
    assert wardrobe.LOOK_OPTIONS["glasses"] == ["none", "round", "star", "heart"]
    assert len(wardrobe.LOOK_OPTIONS["body"]) == 8 and wardrobe.LOOK_OPTIONS["body"][0] == "#ff9a3c"
    assert len(wardrobe.LOOK_OPTIONS["hairColor"]) == 6


def test_shop_waits_for_the_daily_goal(mia):
    visit(mia, "a")
    answer = buy(mia, "schal")
    assert answer.status_code == 409 and code(answer) == "locked"
    visit(mia, "b")
    assert buy(mia, "schal").status_code == 200


def test_play_time_used_up_does_not_close_the_shop(mia, papa):
    papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": 5})
    learn(mia)
    mia.post("/api/playtime", json={"seconds": 300})
    assert mia.get("/api/state").json()["play_seconds"] == 300
    assert buy(mia, "schal").status_code == 200


def test_a_purchase_is_worn_at_once_and_logged(mia):
    learn(mia)
    answer = buy(mia, "schal").json()
    assert answer["state"]["stars"] == 0
    assert answer["wardrobe"]["worn"] == {"neck": "schal"}
    assert answer["wardrobe"]["owned"][0]["id"] == "schal" and answer["wardrobe"]["owned"][0]["how"] == "bought"
    assert answer["wardrobe"]["bought_today"] is True
    entries = mia.get("/api/logbook").json()[0]["entries"]
    assert {"building": "schal", "kind": "buy", "stars": -20} == {
        k: entries[-1][k] for k in ("building", "kind", "stars")
    }


def test_one_purchase_a_day(mia):
    learn(mia)
    visit(mia, "c")
    assert buy(mia, "schleife", "k1").status_code == 200
    second = buy(mia, "kappe", "k2")
    assert second.status_code == 409 and code(second) == "bought_today"
    # The same purchase sent again: nothing taken twice
    again = buy(mia, "schleife", "k1")
    assert again.status_code == 200 and again.json()["state"]["stars"] == 15


def test_a_new_day_allows_a_new_purchase(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-12 23:59")
    learn(mia, "one")
    visit(mia, "one-3")
    assert buy(mia, "schleife", "k1").status_code == 200
    set_time(monkeypatch, "2026-11-13 00:01")
    learn(mia, "two")
    assert mia.get("/api/wardrobe").json()["bought_today"] is False
    assert buy(mia, "kappe", "k2").status_code == 200


def test_two_purchases_at_once_buy_one(mia):
    learn(mia)
    visit(mia, "c")
    visit(mia, "d")
    results: list[str] = []
    start = threading.Barrier(2)

    def attempt(item, key):
        connection = database.connect()
        try:
            start.wait()
            wardrobe.buy(connection, 2, item, key)
            results.append("ok")
        except game.Refused as refused:
            results.append(refused.code)
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt, args=(i, f"k-{i}")) for i in ("schleife", "kappe")]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["bought_today", "ok"]
    stars = mia.get("/api/state").json()["stars"]
    assert stars in (40 - 15, 40 - 20)


def test_shelves_open_with_two_from_above(mia, monkeypatch):
    for day, item in (("12", "schleife"), ("13", "kleid"), ("14", "kappe"), ("15", "kleid")):
        set_time(monkeypatch, f"2026-11-{day} 10:00")
        learn(mia, day)
        # Stars enough for anything: only the shelves decide (the player's row exists after the first visit)
        set_money(500, 0)
        answer = buy(mia, item, f"k-{day}")
        expected = {"12": 200, "13": 409, "14": 200, "15": 200}[day]
        assert answer.status_code == expected, (day, answer.json())
        if expected == 409:
            assert code(answer) == "shelf_locked"


def test_gifts_are_not_for_sale_and_do_not_open_shelves(mia):
    learn(mia)
    answer = buy(mia, "glitzerband")
    assert answer.status_code == 409 and code(answer) == "not_for_sale"
    assert buy(mia, "gibtsnicht").status_code == 404


def test_owning_twice_is_refused(mia, monkeypatch):
    learn(mia)
    buy(mia, "schal", "a")
    set_time(monkeypatch, "2026-11-13 10:00")
    learn(mia, "next")
    answer = buy(mia, "schal", "b")
    assert answer.status_code == 409 and code(answer) == "owned"


def test_too_little_shop_money(mia):
    learn(mia)
    set_money(30, 30)
    answer = buy(mia, "schal")
    assert answer.status_code == 409 and code(answer) == "poor"


def test_saved_stars_count_half(mia):
    learn(mia)
    set_money(90, 60)
    answer = buy(mia, "schal").json()
    assert answer["state"]["stars"] == 50 and answer["state"]["savings"] == 20
    entries = mia.get("/api/logbook").json()[0]["entries"]
    assert entries[-1]["stars"] == -40


def test_savings_never_exceed_stars(mia):
    learn(mia)
    set_money(50, 50)
    state = mia.post("/api/plays", json={"building": "arcade", "key": "p"}).json()["state"]
    assert state["stars"] == 47 and state["savings"] == 47


def test_parent_star_change_clamps_savings(mia, papa):
    learn(mia)
    set_money(80, 60)
    assert papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": None, "stars": 30}).json()["savings"] == 30
    assert (
        papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": None, "stars": 100}).json()["savings"] == 30
    )


def test_migration_notes_savings(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    old = sqlite3.connect(tmp_path / "brightville.db")
    for step in database.MIGRATIONS[:6]:
        old.executescript(step)
    old.execute("INSERT INTO players (person_id, stars) VALUES (2, 140)")
    old.execute("PRAGMA user_version = 6")
    old.commit()
    old.close()
    connection = database.connect()
    assert connection.execute("SELECT savings FROM players WHERE person_id = 2").fetchone()[0] == 140
    connection.close()


def test_worn_must_be_owned_and_in_its_place(mia):
    learn(mia)
    buy(mia, "schal")
    worn = mia.put("/api/worn", json={"worn": {"head": "krone", "neck": None}}).json()["worn"]
    assert worn == {}
    worn = mia.put("/api/worn", json={"worn": {"head": "schal", "back": "weg"}}).json()["worn"]
    assert worn == {}
    assert mia.put("/api/worn", json={"worn": {"neck": "schal"}}).json()["worn"] == {"neck": "schal"}


def test_sticker_gifts_arrive_with_and_after_the_sticker(mia, monkeypatch):
    for i in range(10):
        set_time(monkeypatch, f"2026-11-{10 + i:02d} 10:00")
        visit(mia, f"v{i}")
    assert "sternensammler" in [s["id"] for s in mia.get("/api/stickers").json()]
    gift = next(o for o in mia.get("/api/wardrobe").json()["owned"] if o["id"] == "glitzerband")
    assert gift["how"] == "gift"


def test_a_sticker_from_before_brings_its_gift_on_the_next_visit(mia):
    with database.connect() as connection:
        connection.execute(
            "INSERT INTO stickers (person_id, sticker_id, earned_at, seen) VALUES (2, 'tanzstern', ?, 1)",
            ("2026-11-01T10:00:00+01:00",),
        )
    mia.get("/api/stickers")
    assert "discokette" in owned(mia)


def test_parents_see_savings_and_owned(mia, papa):
    learn(mia)
    buy(mia, "schal")
    row = next(r for r in papa.get("/api/players").json() if r["id"] == 2)
    assert row["owned"] == ["schal"]
    assert row["savings"] == 0
