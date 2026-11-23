"""The level per child: Kindergarten (as always) or Oberstufe, where only the buildings with Oberstufe content open."""


def oberstufe(papa, person_id=2):
    assert (
        papa.put(
            "/api/players/%d" % person_id, json={"daily_goal": 1, "play_minutes": None, "level": "oberstufe"}
        ).status_code
        == 200
    )


def test_every_child_starts_at_kindergarten(mia):
    assert mia.get("/api/state").json()["level"] == "kindergarten"


def test_parent_sets_level(papa, mia):
    oberstufe(papa)
    assert mia.get("/api/state").json()["level"] == "oberstufe"
    # Left out, the level stays
    papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": None})
    assert mia.get("/api/state").json()["level"] == "oberstufe"
    assert [p["level"] for p in papa.get("/api/players").json() if p["id"] == 2] == ["oberstufe"]
    answer = papa.put("/api/players/2", json={"daily_goal": 2, "play_minutes": None, "level": "gymnasium"})
    assert answer.status_code == 422


def test_oberstufe_school_gives_up_to_15(papa, mia, family_hub):
    from conftest import as_person

    ben = as_person("Ben")
    oberstufe(papa)
    assert mia.post("/api/visits", json={"building": "school", "stars": 15, "key": "a"}).json()["state"]["stars"] == 15
    assert mia.post("/api/visits", json={"building": "school", "stars": 20, "key": "b"}).json()["state"]["stars"] == 30
    assert ben.post("/api/visits", json={"building": "school", "stars": 15, "key": "c"}).json()["state"]["stars"] == 10


def test_soon_buildings_refused_at_oberstufe(papa, mia):
    oberstufe(papa)
    answer = mia.post("/api/visits", json={"building": "unterschiede", "stars": 3, "key": "r"})
    assert answer.status_code == 409 and answer.json()["detail"]["code"] == "soon"
    answer = mia.post("/api/free-visits", json={"building": "ausmalen", "key": "f"})
    assert answer.status_code == 409 and answer.json()["detail"]["code"] == "soon"
    mia.post("/api/visits", json={"building": "school", "stars": 3, "key": "s"})
    answer = mia.post("/api/plays", json={"building": "arcade", "key": "p"})
    assert answer.status_code == 409 and answer.json()["detail"]["code"] == "soon"
    assert mia.post("/api/free-visits", json={"building": "malen", "key": "m"}).status_code == 200
    assert mia.post("/api/free-visits", json={"building": "haus", "key": "h"}).status_code == 200
    # Nothing was counted for the refused ones
    assert mia.get("/api/state").json()["visits"] == 1


def test_kindergarten_unchanged(mia):
    assert mia.post("/api/visits", json={"building": "reimhaus", "stars": 3, "key": "r"}).status_code == 200
    assert mia.post("/api/free-visits", json={"building": "ausmalen", "key": "f"}).status_code == 200
    answer = mia.post("/api/plays", json={"building": "arcade", "key": "p"})
    assert answer.status_code == 409 and answer.json()["detail"]["code"] == "locked"


def test_schreiben_and_reimhaus_open_at_oberstufe(papa, mia):
    oberstufe(papa)
    answer = mia.post("/api/visits", json={"building": "schreiben", "stars": 20, "key": "s"})
    assert answer.status_code == 200 and answer.json()["state"]["stars"] == 15
    answer = mia.post("/api/visits", json={"building": "reimhaus", "stars": 20, "key": "r"})
    assert answer.status_code == 200 and answer.json()["state"]["stars"] == 25


def test_muster_opens_at_oberstufe(papa, mia):
    oberstufe(papa)
    answer = mia.post("/api/visits", json={"building": "muster", "stars": 20, "key": "m"})
    assert answer.status_code == 200 and answer.json()["state"]["stars"] == 15


def test_bibliothek_opens_at_oberstufe(papa, mia):
    oberstufe(papa)
    answer = mia.post("/api/visits", json={"building": "bibliothek", "stars": 20, "key": "b"})
    assert answer.status_code == 200 and answer.json()["state"]["stars"] == 10


def test_kalender_opens_at_oberstufe(papa, mia):
    oberstufe(papa)
    answer = mia.post("/api/visits", json={"building": "kalender", "stars": 20, "key": "k"})
    assert answer.status_code == 200 and answer.json()["state"]["stars"] == 15


def test_spielwelt_opens_at_oberstufe(papa, mia):
    oberstufe(papa)
    answer = mia.post("/api/visits", json={"building": "spielwelt", "stars": 20, "key": "w"})
    assert answer.status_code == 200 and answer.json()["state"]["stars"] == 10


def test_movement_buildings_open_at_oberstufe(papa, mia):
    oberstufe(papa)
    for building, key, stars in [("yoga", "y", 9), ("huepfhalle", "h", 18), ("tanzsaal", "t", 28)]:
        answer = mia.post("/api/visits", json={"building": building, "stars": 20, "key": key})
        assert answer.status_code == 200 and answer.json()["state"]["stars"] == stars
