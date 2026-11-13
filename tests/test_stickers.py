from conftest import as_person, set_time

from app import db as database
from app.buildings import all_buildings
from app.stickers import catalogue


def visit(browser, key, building="school", stars=3):
    return browser.post("/api/visits", json={"building": building, "stars": stars, "key": key})


def free(browser, key, building="malen"):
    return browser.post("/api/free-visits", json={"building": building, "key": key})


def stickers(browser):
    return [s["id"] for s in browser.get("/api/stickers").json()]


def test_the_catalogue_names_only_rules_and_buildings_that_exist():
    known = all_buildings()
    ids = [s.id for s in catalogue()]
    assert len(ids) == len(set(ids)) == 17
    for s in catalogue():
        assert s.emoji and s.name and s.says
        assert sum(k in s.rule for k in ("visits", "different", "streak", "goalDays", "stars")) == 1
        for b in s.rule.get("buildings", []):
            assert b in known


def test_ten_visits_to_a_building_earn_its_sticker_once(mia):
    for i in range(9):
        assert visit(mia, f"v{i}").json()["stickers"] == []
    assert visit(mia, "v9").json()["stickers"] == ["rechenprofi"]
    assert visit(mia, "v10").json()["stickers"] == []
    assert stickers(mia) == ["rechenprofi"]


def test_a_visit_sent_twice_does_not_count_twice_towards_a_sticker(mia):
    for _ in range(10):
        visit(mia, "same")
    assert stickers(mia) == []


def test_visits_to_malen_and_ausmalen_are_recorded_and_earn_kunstwerk(mia):
    for i in range(5):
        assert free(mia, f"m{i}").json() == {"stickers": []}
        free(mia, f"m{i}")
    for i in range(4):
        free(mia, f"a{i}", "ausmalen")
    assert free(mia, "a4", "ausmalen").json() == {"stickers": ["kunstwerk"]}
    # Free visits give and cost nothing
    state = mia.get("/api/state").json()
    assert state["stars"] == 0 and state["visits"] == 0


def test_only_free_buildings_take_free_visits(mia):
    assert free(mia, "x", "school").status_code == 422
    assert free(mia, "x", "castle").status_code == 404
    assert free(mia, "", "malen").status_code == 422


def test_a_hundred_stars_earn_the_sternensammler(mia):
    buildings = ["school", "schreiben", "unterschiede", "farblabor", "bibliothek"]
    for i in range(10):
        visit(mia, f"v{i}", buildings[i % 5], 10 if buildings[i % 5] != "bibliothek" else 9)
    assert "sternensammler" not in stickers(mia)
    assert "sternensammler" in visit(mia, "last", "school", 2).json()["stickers"]


def test_six_different_learning_buildings_earn_the_entdecker(mia):
    for b in ["school", "schreiben", "yoga", "unterschiede", "bibliothek"]:
        visit(mia, b, b)
    assert "entdecker" not in stickers(mia)
    assert visit(mia, "f", "farblabor").json()["stickers"] == ["entdecker"]


def test_the_goal_three_days_in_a_row_earns_drei_am_stueck(mia, monkeypatch):
    for day in ("10", "11"):
        set_time(monkeypatch, f"2026-11-{day} 16:00")
        visit(mia, f"{day}a")
        visit(mia, f"{day}b")
    set_time(monkeypatch, "2026-11-12 16:00")
    assert visit(mia, "12a").json()["stickers"] == []
    assert visit(mia, "12b").json()["stickers"] == ["dreiamstueck"]


def test_a_day_without_the_goal_breaks_the_row(mia, monkeypatch):
    for day in ("08", "09", "11", "12"):
        set_time(monkeypatch, f"2026-11-{day} 16:00")
        visit(mia, f"{day}a")
        visit(mia, f"{day}b")
    assert "dreiamstueck" not in stickers(mia)


def test_a_goal_reached_stays_reached_when_the_parents_raise_it_later(mia, papa, monkeypatch):
    for day in ("10", "11"):
        set_time(monkeypatch, f"2026-11-{day} 16:00")
        visit(mia, f"{day}a")
        visit(mia, f"{day}b")
    papa.put("/api/players/2", json={"daily_goal": 3, "play_minutes": None})
    set_time(monkeypatch, "2026-11-12 16:00")
    for k in ("a", "b"):
        visit(mia, k)
    assert visit(mia, "c").json()["stickers"] == ["dreiamstueck"]


def test_history_from_before_stickers_counts_when_the_page_loads(mia):
    # Ten school visits as earlier stages recorded them: events only, no sticker given
    with database.connect() as db:
        for i in range(10):
            db.execute(
                "INSERT INTO events (person_id, key, kind, building, stars, at) VALUES (2, ?, 'visit', 'school', 3, ?)",
                (f"old{i}", f"2026-10-{10 + i}T16:00:00+02:00"),
            )
    assert stickers(mia) == ["rechenprofi"]


def test_stickers_are_new_until_seen(mia):
    for i in range(10):
        visit(mia, f"v{i}")
    listing = mia.get("/api/stickers").json()
    assert listing == [{"id": "rechenprofi", "earned_at": "2026-11-12T10:00:00+01:00", "seen": False}]
    assert mia.post("/api/stickers/seen", json={"ids": ["rechenprofi", "nonsense"]}).json() == {"ok": True}
    assert mia.get("/api/stickers").json()[0]["seen"] is True


def test_each_child_has_their_own_stickers(mia, family_hub):
    for i in range(10):
        visit(mia, f"v{i}")
    assert stickers(as_person("Ben")) == []
