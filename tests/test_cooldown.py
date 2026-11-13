"""The cool-down between earning visits (security review, Nov 2026): Stars can't be sent faster than a child earns
them, and a visit that comes too soon is only delayed, never lost; and the other guards from that review."""

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from conftest import set_time

from app import clock, game, main
from app import db as database
from app.buildings import all_buildings


@pytest.fixture(autouse=True)
def cooldown(monkeypatch):
    monkeypatch.setattr(game, "COOLDOWN", True)


def visit(browser, key, building="school", stars=10):
    return browser.post("/api/visits", json={"building": building, "stars": stars, "key": key})


def test_every_earning_building_has_a_pace():
    for b in all_buildings().values():
        if b.kind == "earn":
            assert b.min_seconds_per_star > 0, b.id


def test_a_visit_sooner_than_its_stars_take_waits_and_then_counts(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-12 10:00")
    assert visit(mia, "a").status_code == 200
    # School: 2 s per Star, so ten Stars need 20 s after the visit before
    set_time(monkeypatch, "2026-11-12 10:00")
    answer = visit(mia, "b")
    assert answer.status_code == 409
    assert answer.json()["detail"] == {"code": "too_soon", "retry_after": 20}
    assert mia.get("/api/state").json()["stars"] == 10
    # Sent again later under the same key, as the page does: it counts once
    set_time(monkeypatch, "2026-11-12 10:01")
    assert visit(mia, "b").status_code == 200
    assert visit(mia, "b").json()["state"]["stars"] == 20


def test_the_wait_follows_the_stars_and_the_building(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-12 10:00")
    visit(mia, "a")
    # 30 s later: a short visit of 3 Stars fits (6 s); a full Tanzsaal of 10 Stars (40 s) doesn't
    later = datetime(2026, 11, 12, 10, 0, 30, tzinfo=ZoneInfo("Europe/Zurich"))
    monkeypatch.setattr(clock, "now", lambda: later)
    assert visit(mia, "t", building="tanzsaal").json()["detail"] == {"code": "too_soon", "retry_after": 10}
    assert visit(mia, "s", stars=3).status_code == 200


def test_children_have_their_own_cool_down(mia, family_hub, monkeypatch):
    from conftest import as_person

    set_time(monkeypatch, "2026-11-12 10:00")
    assert visit(mia, "a").status_code == 200
    assert visit(as_person("Ben"), "a").status_code == 200


def test_a_key_from_another_day_buys_nothing_and_erases_nothing(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-11 10:00")
    visit(mia, "old")
    # Today's goal reached, with Stars enough: only the old key stands in the way
    set_time(monkeypatch, "2026-11-12 10:00")
    visit(mia, "x")
    set_time(monkeypatch, "2026-11-12 10:30")
    visit(mia, "y")
    answer = mia.post("/api/plays", json={"building": "arcade", "key": "old"})
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "key_used"
    with database.connect() as db:
        kept = db.execute("SELECT kind, building FROM events WHERE person_id = 2 AND key = 'old'").fetchone()
    assert tuple(kept) == ("visit", "school")


def test_paintings_are_read_at_most_two_at_a_time():
    async def run():
        inside = 0
        most = 0

        async def upload(_request):
            nonlocal inside, most
            inside += 1
            most = max(most, inside)
            await asyncio.sleep(0.01)
            inside -= 1

        class Upload:
            method = "PUT"

            class url:
                path = "/api/paintings/p1"

        main._uploads = asyncio.Semaphore(main.UPLOADS_AT_ONCE)
        await asyncio.gather(*(main.uploads_in_turn(Upload(), upload) for _ in range(6)))
        return most

    assert asyncio.run(run()) == main.UPLOADS_AT_ONCE
