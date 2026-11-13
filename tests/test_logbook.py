import base64
from datetime import datetime

from conftest import set_time

from app import clock

PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"x" * 100).decode()


def visit(browser, key, building="school", stars=3):
    return browser.post("/api/visits", json={"building": building, "stars": stars, "key": key})


def test_a_day_lists_what_was_done_in_order_with_the_stars(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-12 15:00")
    visit(mia, "a", "school", 7)
    set_time(monkeypatch, "2026-11-12 15:20")
    mia.post("/api/free-visits", json={"building": "malen", "key": "m"})
    set_time(monkeypatch, "2026-11-12 15:40")
    visit(mia, "b", "bibliothek", 9)
    set_time(monkeypatch, "2026-11-12 16:00")
    mia.post("/api/plays", json={"building": "arcade", "key": "p"})
    days = mia.get("/api/logbook").json()
    assert days == [
        {
            "day": "2026-11-12",
            "goal_reached": True,
            "entries": [
                {"building": "school", "kind": "visit", "stars": 7, "at": "15:00"},
                {"building": "malen", "kind": "free", "stars": 0, "at": "15:20"},
                {"building": "bibliothek", "kind": "visit", "stars": 9, "at": "15:40"},
                {"building": "arcade", "kind": "play", "stars": -3, "at": "16:00"},
            ],
            "stickers": [],
            "paintings": [],
        }
    ]


def test_days_come_newest_first_only_when_something_happened_and_page_back(mia, monkeypatch):
    for day in ("03", "05", "06", "09", "12"):
        set_time(monkeypatch, f"2026-11-{day} 10:00")
        visit(mia, day)
    first = mia.get("/api/logbook?days=3").json()
    assert [d["day"] for d in first] == ["2026-11-12", "2026-11-09", "2026-11-06"]
    assert first[0]["goal_reached"] is False
    older = mia.get("/api/logbook?days=3&before=2026-11-06").json()
    assert [d["day"] for d in older] == ["2026-11-05", "2026-11-03"]
    assert mia.get("/api/logbook?before=2026-11-03").json() == []


def test_a_visit_late_in_the_evening_belongs_to_that_day_at_home(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-12 23:45")
    visit(mia, "late")
    assert [d["day"] for d in mia.get("/api/logbook").json()] == ["2026-11-12"]


def test_a_day_shows_the_stickers_earned_and_the_paintings_made_that_day(mia):
    for i in range(10):
        visit(mia, f"v{i}")
    mia.put("/api/paintings/p-1", json={"image": PNG, "thumb": PNG})
    painted = mia.get("/api/paintings").json()[0]["updated"]
    painted_day = datetime.fromtimestamp(painted / 1000, clock.zone()).strftime("%Y-%m-%d")
    days = {d["day"]: d for d in mia.get("/api/logbook").json()}
    assert days["2026-11-12"]["stickers"] == ["rechenprofi"]
    assert days[painted_day]["paintings"] == [{"id": "p-1", "updated": painted}]


def test_bad_paging_is_refused(mia):
    assert mia.get("/api/logbook?days=0").status_code == 422
    assert mia.get("/api/logbook?days=100").status_code == 422
    assert mia.get("/api/logbook?before=yesterday").status_code == 422


def test_a_parent_reads_a_childs_logbook_and_stickers(papa, mia):
    for i in range(10):
        visit(mia, f"v{i}")
    diary = papa.get("/api/players/2/diary").json()
    assert [d["day"] for d in diary["days"]] == ["2026-11-12"]
    assert [s["id"] for s in diary["stickers"]] == ["rechenprofi"]
    # Reading it is not the child seeing it
    assert diary["stickers"][0]["seen"] is False


def test_children_cannot_read_other_diaries_and_unknown_people_have_none(papa, mia):
    assert mia.get("/api/players/2/diary").status_code == 403
    assert papa.get("/api/players/99/diary").status_code == 404
