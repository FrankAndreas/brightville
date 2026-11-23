"""The Oberstufe's speaking (the Trommelhaus): what he said right (right count, last day right, last day asked)."""


def send(who, key, answers, lang="en"):
    return who.post("/api/speak/results", json={"key": key, "lang": lang, "answers": answers})


def test_results_move_the_record_once(mia):
    state = send(
        mia,
        "k1",
        [{"item": "en:speak:travel:window", "right": True}, {"item": "en:speak:sentence:food:menu", "right": False}],
    ).json()
    assert state["progress"]["en:speak:travel:window"] == {
        "right": 1,
        "last_right": "2026-11-12",
        "last_asked": "2026-11-12",
    }
    assert state["progress"]["en:speak:sentence:food:menu"] == {
        "right": 0,
        "last_right": None,
        "last_asked": "2026-11-12",
    }
    assert "k1" in state["seen"]
    again = send(mia, "k1", [{"item": "en:speak:travel:window", "right": True}]).json()
    assert again["progress"]["en:speak:travel:window"]["right"] == 1
    assert mia.get("/api/speak").json()["progress"]["en:speak:travel:window"]["right"] == 1


def test_only_speaking_keys_of_the_rounds_language(mia):
    answers = [
        {"item": "fr:speak:travel:gare", "right": True},
        {"item": "en:travel:window", "right": True},
        {"item": "en:speakx", "right": True},
    ]
    assert send(mia, "k", answers).json()["progress"] == {}
    assert send(mia, "k2", [{"item": "x", "right": True}], lang="de").status_code == 422


def test_parents_see_what_he_said(papa, mia):
    send(mia, "k", [{"item": "fr:speak:own:la gare|der bahnhof", "right": True}], lang="fr")
    seen = papa.get("/api/players/2/speak").json()
    assert seen["progress"]["fr:speak:own:la gare|der bahnhof"]["right"] == 1
    assert "seen" not in seen
    assert mia.get("/api/players/2/speak").status_code == 403
    assert papa.get("/api/players/99/speak").status_code == 404
