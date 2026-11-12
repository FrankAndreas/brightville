from conftest import as_person


def names(answer):
    return [p["name"] for p in answer.json()]


def test_children_cannot_see_or_change_the_settings(mia):
    answer = mia.get("/api/players")
    assert answer.status_code == 403
    assert answer.json()["detail"]["code"] == "parents_only"
    assert mia.put("/api/players/2", json={"daily_goal": 1, "play_minutes": None, "stars": 999}).status_code == 403


def test_a_parent_sees_everyone_who_may_play_children_first(papa, mia):
    mia.post("/api/visits", json={"building": "school", "stars": 4, "key": "v"})
    answer = papa.get("/api/players")
    assert names(answer) == ["Ben", "Mia", "Papa"]
    assert answer.json()[1] == {
        "id": 2,
        "name": "Mia",
        "role": "CHILD",
        "color": "#ff66aa",
        "stars": 4,
        "day": "2026-11-12",
        "visits": 1,
        "daily_goal": 2,
        "play_seconds": 0,
        "play_minutes": None,
    }


def test_a_parent_sets_the_goal_the_play_time_and_the_stars(papa, mia):
    answer = papa.put("/api/players/2", json={"daily_goal": 1, "play_minutes": 20, "stars": 12})
    assert answer.status_code == 200
    assert mia.get("/api/state").json() == {
        "stars": 12,
        "day": "2026-11-12",
        "visits": 0,
        "daily_goal": 1,
        "play_seconds": 0,
        "play_minutes": 20,
    }
    mia.post("/api/visits", json={"building": "school", "stars": 1, "key": "v"})
    assert mia.post("/api/plays", json={"building": "arcade", "key": "p"}).status_code == 200


def test_the_goal_reached_flag_follows_the_childs_own_goal(papa, mia):
    papa.put("/api/players/2", json={"daily_goal": 1, "play_minutes": None, "stars": 0})
    assert (
        mia.post("/api/visits", json={"building": "school", "stars": 1, "key": "v"}).json()["goal_reached_now"] is True
    )


def test_a_parent_may_leave_the_stars_alone(papa, mia):
    papa.get("/api/players")
    mia.post("/api/visits", json={"building": "school", "stars": 6, "key": "v"})
    answer = papa.put("/api/players/2", json={"daily_goal": 3, "play_minutes": 10})
    assert answer.status_code == 200
    assert mia.get("/api/state").json()["stars"] == 6
    assert mia.get("/api/state").json()["daily_goal"] == 3


def test_settings_out_of_range_are_refused(papa):
    for body in (
        {"daily_goal": 0, "play_minutes": None, "stars": 0},
        {"daily_goal": 6, "play_minutes": None, "stars": 0},
        {"daily_goal": 2, "play_minutes": 4, "stars": 0},
        {"daily_goal": 2, "play_minutes": 181, "stars": 0},
        {"daily_goal": 2, "play_minutes": None, "stars": -1},
        {"daily_goal": 2, "play_minutes": None, "stars": 10000},
    ):
        assert papa.put("/api/players/2", json=body).status_code == 422


def test_someone_unknown_cannot_be_set(papa):
    assert papa.put("/api/players/77", json={"daily_goal": 2, "play_minutes": None, "stars": 5}).status_code == 404


def test_someone_who_left_is_hidden_and_keeps_their_stars(papa, mia, family_hub):
    mia.post("/api/visits", json={"building": "school", "stars": 4, "key": "v"})
    family_hub.remove_access("Mia")
    assert names(papa.get("/api/players")) == ["Ben", "Papa"]
    assert papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": None, "stars": 5}).status_code == 404
    family_hub.give_access("Mia")
    assert papa.get("/api/players").json()[1]["stars"] == 4


def test_a_child_made_parent_in_the_hub_gets_in(mia, family_hub):
    family_hub.set_role("Mia", "PARENT")
    assert as_person("Mia").get("/api/players").status_code == 200
