"""The Oberstufe's grammar: per topic, his first answers of the last 20 and the items missed last time."""


def send(who, key, answers, lang="en"):
    return who.post("/api/grammar/results", json={"key": key, "lang": lang, "answers": answers})


def ans(item, right):
    return {"item": item, "right": right}


def test_results_build_the_record_per_topic(mia):
    state = send(mia, "k1", [ans("en:modals:3", True), ans("en:modals:5", False), ans("en:passive:1", True)]).json()
    assert state["progress"]["en:modals"] == {"recent": [True, False], "missed": ["en:modals:5"]}
    assert state["progress"]["en:passive"] == {"recent": [True], "missed": []}
    assert "k1" in state["seen"]
    state = send(mia, "k2", [ans("en:modals:5", True)]).json()
    assert state["progress"]["en:modals"] == {"recent": [True, False, True], "missed": []}
    assert mia.get("/api/grammar").json()["progress"]["en:modals"]["recent"] == [True, False, True]


def test_the_record_keeps_the_last_20(mia):
    send(mia, "a", [ans(f"en:modals:{i}", i % 2 == 0) for i in range(25)])
    recent = mia.get("/api/grammar").json()["progress"]["en:modals"]["recent"]
    assert len(recent) == 20 and recent == [i % 2 == 0 for i in range(5, 25)]


def test_the_same_key_counts_once(mia):
    send(mia, "k", [ans("en:modals:1", True)])
    state = send(mia, "k", [ans("en:modals:1", True)]).json()
    assert state["progress"]["en:modals"]["recent"] == [True]


def test_other_languages_and_odd_items_are_skipped(mia):
    state = send(mia, "k", [ans("fr:articles:1", True), ans("en:x", True)]).json()
    assert state["progress"] == {}
    assert send(mia, "k2", [ans("de:x:1", True)], lang="de").status_code == 422


def test_parents_see_his_grammar(papa, mia):
    send(mia, "k", [ans("en:modals:1", False)])
    seen = papa.get("/api/players/2/grammar").json()
    assert seen["progress"]["en:modals"]["missed"] == ["en:modals:1"]
    assert "seen" not in seen
    assert mia.get("/api/players/2/grammar").status_code == 403
