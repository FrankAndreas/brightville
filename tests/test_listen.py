"""The Oberstufe's listening scenes: which he understood (right count, last day right, last day asked)."""


def send(who, key, answers, lang="en"):
    return who.post("/api/listen/results", json={"key": key, "lang": lang, "answers": answers})


def test_results_move_the_record_once(mia):
    state = send(mia, "k1", [{"scene": "en:travel:platform", "right": True}]).json()
    assert state["progress"]["en:travel:platform"] == {
        "right": 1,
        "last_right": "2026-11-12",
        "last_asked": "2026-11-12",
    }
    assert "k1" in state["seen"]
    again = send(mia, "k1", [{"scene": "en:travel:platform", "right": True}]).json()
    assert again["progress"]["en:travel:platform"]["right"] == 1
    assert mia.get("/api/listen").json()["progress"]["en:travel:platform"]["right"] == 1


def test_a_wrong_answer_only_marks_it_asked(mia):
    state = send(mia, "k", [{"scene": "en:food:menu", "right": False}]).json()
    assert state["progress"]["en:food:menu"] == {"right": 0, "last_right": None, "last_asked": "2026-11-12"}
    state = send(mia, "k2", [{"scene": "en:food:menu", "right": True}]).json()
    state = send(mia, "k3", [{"scene": "en:food:menu", "right": False}]).json()
    assert state["progress"]["en:food:menu"] == {"right": 1, "last_right": "2026-11-12", "last_asked": "2026-11-12"}


def test_results_never_cross_languages(mia):
    state = send(mia, "k", [{"scene": "fr:travel:gare", "right": True}]).json()
    assert state["progress"] == {}
    assert send(mia, "k4", [{"scene": "x", "right": True}], lang="de").status_code == 422


def test_parents_see_what_he_understood(papa, mia):
    send(mia, "k", [{"scene": "en:travel:platform", "right": True}])
    seen = papa.get("/api/players/2/listen").json()
    assert seen["progress"]["en:travel:platform"]["right"] == 1
    assert "seen" not in seen
    assert mia.get("/api/players/2/listen").status_code == 403
