from conftest import as_person, set_time


def visit(browser, stars, key, building="school"):
    return browser.post("/api/visits", json={"building": building, "stars": stars, "key": key})


def play(browser, key, building="arcade"):
    return browser.post("/api/plays", json={"building": building, "key": key})


def test_a_new_player_starts_with_nothing_and_the_usual_rules(mia):
    assert mia.get("/api/state").json() == {
        "stars": 0,
        "day": "2026-11-12",
        "visits": 0,
        "daily_goal": 2,
        "play_seconds": 0,
        "play_minutes": None,
        "savings": 0,
    }


def test_an_earning_visit_adds_stars_and_counts(mia):
    answer = visit(mia, 7, "v1")
    assert answer.status_code == 200
    assert answer.json()["state"]["stars"] == 7
    assert answer.json()["state"]["visits"] == 1
    assert answer.json()["goal_reached_now"] is False
    assert mia.get("/api/state").json()["stars"] == 7


def test_the_second_visit_reaches_the_goal_and_only_that_one_says_so(mia):
    visit(mia, 1, "v1")
    assert visit(mia, 1, "v2").json()["goal_reached_now"] is True
    assert visit(mia, 1, "v3").json()["goal_reached_now"] is False


def test_a_visit_never_gives_more_than_the_building_can(mia):
    assert visit(mia, 500, "v1").json()["state"]["stars"] == 10
    assert visit(mia, 500, "v2", "yoga").json()["state"]["stars"] == 19


def test_a_visit_without_stars_does_not_count(mia):
    answer = visit(mia, 0, "v1")
    assert answer.status_code == 200
    assert answer.json()["state"] == {**answer.json()["state"], "stars": 0, "visits": 0}


def test_a_visit_sent_twice_counts_once(mia):
    first = visit(mia, 4, "same")
    again = visit(mia, 4, "same")
    assert again.status_code == 200
    assert again.json()["state"] == first.json()["state"]
    assert again.json()["goal_reached_now"] is False
    assert visit(mia, 4, "other").json()["state"]["stars"] == 8


def test_two_children_may_use_the_same_key(mia, family_hub):
    visit(mia, 4, "k")
    assert visit(as_person("Ben"), 2, "k").json()["state"]["stars"] == 2


def test_bad_visits_are_refused(mia):
    assert visit(mia, 3, "v", "castle").status_code == 404
    assert visit(mia, 3, "v", "arcade").status_code == 422
    assert visit(mia, -1, "v").status_code == 422
    assert visit(mia, 3, "").status_code == 422
    assert visit(mia, 3, "x" * 200).status_code == 422
    assert mia.get("/api/state").json()["stars"] == 0


def test_play_is_locked_until_the_goal_is_reached(mia):
    visit(mia, 10, "v1")
    answer = play(mia, "p1")
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "locked"
    assert mia.get("/api/state").json()["stars"] == 10


def test_play_needs_the_stars(mia):
    visit(mia, 1, "v1")
    visit(mia, 1, "v2")
    answer = play(mia, "p1")
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "poor"


def test_a_round_costs_its_price_once_however_often_it_is_sent(mia):
    visit(mia, 5, "v1")
    visit(mia, 5, "v2")
    assert play(mia, "p1").json()["state"]["stars"] == 7
    assert play(mia, "p1").json()["state"]["stars"] == 7
    assert play(mia, "p2").json()["state"]["stars"] == 4


def test_only_play_buildings_sell_rounds(mia):
    assert play(mia, "p", "school").status_code == 422
    assert play(mia, "p", "castle").status_code == 404


def test_a_free_building_neither_earns_nor_sells(mia):
    for building in ("ausmalen", "malen"):
        assert visit(mia, 5, f"v-{building}", building).json()["detail"]["code"] == "wrong_kind"
        assert play(mia, f"p-{building}", building).json()["detail"]["code"] == "wrong_kind"
    assert mia.get("/api/state").json()["stars"] == 0
    assert mia.get("/api/state").json()["visits"] == 0


def test_play_time_adds_up_and_ends_play_when_the_limit_is_reached(mia, papa):
    visit(mia, 10, "v1")
    visit(mia, 10, "v2")
    papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": 5, "stars": 20})
    assert mia.post("/api/playtime", json={"seconds": 200}).json()["play_seconds"] == 200
    assert play(mia, "p1").status_code == 200
    assert mia.post("/api/playtime", json={"seconds": 100}).json()["play_seconds"] == 300
    answer = play(mia, "p2")
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "time_up"
    assert mia.get("/api/state").json()["stars"] == 17


def test_play_time_reports_are_bounded(mia):
    assert mia.post("/api/playtime", json={"seconds": 0}).status_code == 422
    assert mia.post("/api/playtime", json={"seconds": 100000}).status_code == 422


def test_a_new_day_starts_the_visits_and_the_play_time_over_and_keeps_the_stars(mia, monkeypatch):
    visit(mia, 5, "v1")
    visit(mia, 5, "v2")
    mia.post("/api/playtime", json={"seconds": 60})
    set_time(monkeypatch, "2026-11-13 00:01")
    assert mia.get("/api/state").json() == {
        "stars": 10,
        "day": "2026-11-13",
        "visits": 0,
        "daily_goal": 2,
        "play_seconds": 0,
        "play_minutes": None,
        "savings": 0,
    }
    assert play(mia, "p1").json()["detail"]["code"] == "locked"
    assert visit(mia, 1, "v3").json()["state"]["visits"] == 1


def test_the_day_is_the_one_at_home_not_utc(mia, monkeypatch):
    set_time(monkeypatch, "2026-11-13 00:30")
    assert mia.get("/api/state").json()["day"] == "2026-11-13"


def test_each_person_has_their_own_stars(mia, family_hub):
    visit(mia, 6, "v1")
    assert as_person("Ben").get("/api/state").json()["stars"] == 0


def test_a_round_bought_yesterday_is_not_free_today(mia, monkeypatch):
    visit(mia, 5, "v1")
    visit(mia, 5, "v2")
    assert play(mia, "p1").status_code == 200
    set_time(monkeypatch, "2026-11-13 08:00")
    answer = play(mia, "p1")
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "locked"


def test_the_new_buildings_earn_and_sell_like_the_old(mia):
    assert visit(mia, 50, "u1", "unterschiede").json()["state"]["stars"] == 10
    visit(mia, 1, "v2")
    for building in ("schlange", "bonbonjagd"):
        assert play(mia, f"p-{building}", building).status_code == 200
    assert mia.get("/api/state").json()["stars"] == 11 - 6


def test_requests_at_the_same_moment_all_get_answers(mia):
    # Leaving a play building sends the play time and asks for the Stars at once
    from concurrent.futures import ThreadPoolExecutor

    visit(mia, 1, "v1")

    def ask(i):
        if i % 2:
            return mia.post("/api/playtime", json={"seconds": 1}).status_code
        return mia.get("/api/state").status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = list(pool.map(ask, range(80)))
    assert codes == [200] * 80
    assert mia.get("/api/state").json()["play_seconds"] == 40


def test_a_connection_opened_in_one_worker_thread_works_in_another():
    # FastAPI may run the get_db dependency and the request in different threads of its pool
    import threading

    from app.auth import get_db

    opening = get_db()
    connection = next(opening)
    errors = []

    def use():
        try:
            connection.execute("SELECT 1").fetchone()
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    worker = threading.Thread(target=use)
    worker.start()
    worker.join()
    opening.close()
    assert errors == []


def test_the_library_and_the_colour_lab_earn_up_to_what_they_give(mia):
    assert visit(mia, 50, "b1", "bibliothek").json()["state"]["stars"] == 9
    assert visit(mia, 50, "f1", "farblabor").json()["state"]["stars"] == 19
