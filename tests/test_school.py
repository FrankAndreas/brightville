"""The School's two Lehrplan 21 ladders on the server: Zählen and Rechnen, each moving up by itself after two visits'
worth of answers with at most one missed on the first try."""

import sqlite3

from app import db as database
from app import school


def state(browser):
    """The two ladders, without the keys the server has seen"""
    answer = browser.get("/api/school").json()
    return {name: answer[name] for name in ("zaehlen", "rechnen", "reimen", "muster", "zeit", "raum")}


def send(browser, key, zaehlen=(1, []), rechnen=(1, [])):
    return browser.post(
        "/api/school/results",
        json={
            "key": key,
            "zaehlen": {"step": zaehlen[0], "results": list(zaehlen[1])},
            "rechnen": {"step": rechnen[0], "results": list(rechnen[1])},
        },
    )


def send_only(browser, key, **ladders):
    """A result naming only some ladders, as the Reimhaus sends"""
    body = {"key": key, **{name: {"step": step, "results": list(results)} for name, (step, results) in ladders.items()}}
    return browser.post("/api/school/results", json=body)


def set_step(browser, ladder, step, person_id=2):
    return browser.put(f"/api/players/{person_id}/school", json={"ladder": ladder, "step": step})


def code(answer):
    return answer.json()["detail"]["code"]


def test_a_new_child_starts_at_zaehlen_1_rechnen_1(mia):
    assert state(mia) == {
        "zaehlen": {"step": 1, "window": []},
        "rechnen": {"step": 1, "window": []},
        "reimen": {"step": 1, "window": []},
        "muster": {"step": 1, "window": []},
        "zeit": {"step": 1, "window": []},
        "raum": {"step": 1, "window": []},
    }


def test_a_child_who_used_the_old_school_starts_rechnen_at_2(tmp_path, monkeypatch):
    """Decided once, when the ladders came: her School visits from before them"""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    old = sqlite3.connect(tmp_path / "brightville.db")
    before = len(database.MIGRATIONS) - 1
    for step in database.MIGRATIONS[:before]:
        old.executescript(step)
    old.execute(
        "INSERT INTO events (person_id, key, kind, building, stars, at) "
        "VALUES (2, 'old', 'visit', 'school', 3, '2026-11-10T10:00:00')"
    )
    old.execute(f"PRAGMA user_version = {before}")
    old.commit()
    old.close()
    connection = database.connect()
    assert school.state(connection, 2)["rechnen"]["step"] == 2
    assert school.state(connection, 2)["zaehlen"]["step"] == 1
    assert school.state(connection, 3)["rechnen"]["step"] == 1
    connection.close()


def test_a_new_child_stays_at_rechnen_1_after_a_visit_with_only_zaehlen(mia):
    assert mia.post("/api/visits", json={"building": "school", "stars": 3, "key": "v1"}).status_code == 200
    send(mia, "a", zaehlen=(1, [True, True, True]))
    assert state(mia)["rechnen"] == {"step": 1, "window": []}
    # And the visit's Rechnen answers, sent after the Stars, still count
    assert mia.post("/api/visits", json={"building": "school", "stars": 3, "key": "v2"}).status_code == 200
    send(mia, "b", rechnen=(1, [True, True]))
    assert state(mia)["rechnen"] == {"step": 1, "window": [True, True]}


def test_the_results_it_has_are_named_so_a_device_can_let_them_go(mia):
    send(mia, "a", rechnen=(1, [True]))
    send(mia, "b", rechnen=(1, [True]))
    assert set(mia.get("/api/school").json()["seen"]) == {"a", "b"}


def test_a_step_must_be_a_whole_number(papa, mia):
    assert set_step(papa, "zaehlen", True).status_code == 422
    assert set_step(papa, "zaehlen", 2.5).status_code == 422


def test_six_answers_with_one_miss_move_zaehlen_up(mia):
    send(mia, "a", zaehlen=(1, [True, True, False]))
    answer = send(mia, "b", zaehlen=(1, [True, True, True])).json()
    assert answer["zaehlen"] == {"step": 2, "window": []}


def test_two_misses_in_six_dont_move(mia):
    send(mia, "a", zaehlen=(1, [True, False, True]))
    send(mia, "b", zaehlen=(1, [True, False, True]))
    send(mia, "c", zaehlen=(1, [True]))
    assert state(mia)["zaehlen"] == {"step": 1, "window": [False, True, True, False, True, True]}


def test_fewer_than_six_answers_dont_move(mia):
    send(mia, "a", zaehlen=(1, [True] * 5))
    assert state(mia)["zaehlen"] == {"step": 1, "window": [True] * 5}


def test_rechnen_needs_four(mia):
    send(mia, "a", rechnen=(1, [True, True]))
    assert state(mia)["rechnen"]["step"] == 1
    send(mia, "b", rechnen=(1, [True, True]))
    assert state(mia)["rechnen"] == {"step": 2, "window": []}


def test_the_same_key_counts_once(mia):
    send(mia, "a", rechnen=(1, [True, True]))
    send(mia, "a", rechnen=(1, [True, True]))
    assert state(mia)["rechnen"] == {"step": 1, "window": [True, True]}


def test_result_at_an_old_step_is_ignored(papa, mia):
    set_step(papa, "zaehlen", 3)
    send(mia, "a", zaehlen=(1, [True] * 6))
    assert state(mia)["zaehlen"] == {"step": 3, "window": []}


def test_step_6_stays_6(papa, mia):
    set_step(papa, "rechnen", 6)
    send(mia, "a", rechnen=(6, [True] * 4))
    assert state(mia)["rechnen"]["step"] == 6


def test_a_parent_sets_a_step_and_the_window_empties(papa, mia):
    send(mia, "a", zaehlen=(1, [True, True]))
    answer = set_step(papa, "zaehlen", 4)
    assert answer.status_code == 200
    assert answer.json()["zaehlen"] == {"step": 4, "window": []}
    assert papa.get("/api/players/2/school").json()["zaehlen"] == {"step": 4, "window": []}


def test_a_child_cannot_set_a_step(mia):
    assert set_step(mia, "zaehlen", 4).status_code == 403


def test_bad_steps_and_ladders_are_refused(papa, mia):
    assert code(set_step(papa, "zaehlen", 0)) == "bad_step"
    assert code(set_step(papa, "zaehlen", 7)) == "bad_step"
    assert code(set_step(papa, "lesen", 2)) == "unknown"


def test_an_unknown_person_is_404(papa):
    assert set_step(papa, "zaehlen", 2, person_id=99).status_code == 404


def test_ten_reimen_answers_with_two_misses_move_up(mia):
    send_only(mia, "a", reimen=(1, [True, False, True, True, True]))
    answer = send_only(mia, "b", reimen=(1, [True, True, False, True, True])).json()
    assert answer["reimen"] == {"step": 2, "window": []}


def test_three_misses_in_ten_dont_move_reimen(mia):
    send_only(mia, "a", reimen=(1, [False, False, True, True, True]))
    send_only(mia, "b", reimen=(1, [False, True, True, True, True]))
    assert state(mia)["reimen"]["step"] == 1


def test_a_result_with_only_reimen_leaves_the_others(mia):
    assert send_only(mia, "a", reimen=(1, [True])).status_code == 200
    assert state(mia)["zaehlen"] == {"step": 1, "window": []}
    assert state(mia)["reimen"] == {"step": 1, "window": [True]}


def test_an_old_result_without_reimen_still_counts(mia):
    assert send(mia, "a", rechnen=(1, [True, True])).status_code == 200
    assert state(mia)["rechnen"]["window"] == [True, True]


def test_a_parent_sets_reimen(papa, mia):
    assert set_step(papa, "reimen", 4).json()["reimen"] == {"step": 4, "window": []}


def test_a_new_child_starts_muster_at_1(mia):
    assert mia.get("/api/school").json()["muster"] == {"step": 1, "window": []}


def test_ten_muster_answers_with_two_misses_move_up(mia):
    send_only(mia, "a", muster=(1, [True, False, True, True, True]))
    answer = send_only(mia, "b", muster=(1, [True, True, False, True, True])).json()
    assert answer["muster"] == {"step": 2, "window": []}


def test_a_result_with_only_muster_leaves_the_others(mia):
    assert send_only(mia, "a", muster=(1, [True])).status_code == 200
    assert state(mia)["reimen"] == {"step": 1, "window": []}
    assert state(mia)["muster"] == {"step": 1, "window": [True]}


def test_a_parent_sets_muster(papa, mia):
    assert set_step(papa, "muster", 5).json()["muster"] == {"step": 5, "window": []}


def test_ten_zeit_answers_with_two_misses_move_up(mia):
    send_only(mia, "a", zeit=(1, [True, False, True, True, True]))
    answer = send_only(mia, "b", zeit=(1, [True, True, False, True, True])).json()
    assert answer["zeit"] == {"step": 2, "window": []}


def test_a_result_with_only_zeit_leaves_the_others(mia):
    assert send_only(mia, "a", zeit=(1, [True])).status_code == 200
    assert state(mia)["muster"] == {"step": 1, "window": []}
    assert state(mia)["zeit"] == {"step": 1, "window": [True]}


def test_a_parent_sets_zeit(papa, mia):
    assert set_step(papa, "zeit", 3).json()["zeit"] == {"step": 3, "window": []}


def test_ten_raum_answers_with_two_misses_move_up(mia):
    send_only(mia, "a", raum=(1, [True, False, True, True, True]))
    answer = send_only(mia, "b", raum=(1, [True, True, False, True, True])).json()
    assert answer["raum"] == {"step": 2, "window": []}


def test_a_result_with_only_raum_leaves_the_others(mia):
    assert send_only(mia, "a", raum=(1, [True])).status_code == 200
    assert state(mia)["zeit"] == {"step": 1, "window": []}
    assert state(mia)["raum"] == {"step": 1, "window": [True]}


def test_a_parent_sets_raum(papa, mia):
    assert set_step(papa, "raum", 6).json()["raum"] == {"step": 6, "window": []}
