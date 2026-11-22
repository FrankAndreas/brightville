"""The Oberstufe's reading room: per text, how often he read it, the last day and the questions right last time."""


def send(who, key, answers, lang="en"):
    return who.post("/api/reading/results", json={"key": key, "lang": lang, "answers": answers})


def test_a_visit_is_recorded_once(mia):
    state = send(mia, "k1", [{"text": "en:travel:hostel", "right": 3}]).json()
    assert state["progress"]["en:travel:hostel"] == {"reads": 1, "last_read": "2026-11-12", "last_right": 3}
    assert "k1" in state["seen"]
    again = send(mia, "k1", [{"text": "en:travel:hostel", "right": 3}]).json()
    assert again["progress"]["en:travel:hostel"]["reads"] == 1
    later = send(mia, "k2", [{"text": "en:travel:hostel", "right": 4}]).json()
    assert later["progress"]["en:travel:hostel"] == {"reads": 2, "last_read": "2026-11-12", "last_right": 4}
    assert mia.get("/api/reading").json()["progress"]["en:travel:hostel"]["reads"] == 2


def test_other_languages_odd_keys_and_counts_are_refused_or_skipped(mia):
    state = send(mia, "k", [{"text": "fr:travel:gare", "right": 2}, {"text": "en:x", "right": 1}]).json()
    assert state["progress"] == {}
    assert send(mia, "k2", [{"text": "en:travel:a", "right": 5}]).status_code == 422


def test_parents_see_his_reading(papa, mia):
    send(mia, "k", [{"text": "en:travel:hostel", "right": 2}])
    seen = papa.get("/api/players/2/reading").json()
    assert seen["progress"]["en:travel:hostel"]["last_right"] == 2
    assert "seen" not in seen
    assert mia.get("/api/players/2/reading").status_code == 403
