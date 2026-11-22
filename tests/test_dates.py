"""The Oberstufe's dates and times: per task kind, his first answers of the last 10."""


def send(who, key, answers, lang="en"):
    return who.post("/api/dates/results", json={"key": key, "lang": lang, "answers": answers})


def ans(kind, right):
    return {"kind": kind, "right": right}


def test_results_build_the_record_per_kind(mia):
    state = send(mia, "k1", [ans("en:spelling", True), ans("en:spelling", False), ans("en:clock-words", True)]).json()
    assert state["progress"]["en:spelling"] == {"recent": [True, False]}
    assert state["progress"]["en:clock-words"] == {"recent": [True]}
    assert "k1" in state["seen"]
    assert send(mia, "k1", [ans("en:spelling", True)]).json()["progress"]["en:spelling"]["recent"] == [True, False]


def test_the_record_keeps_the_last_10(mia):
    send(mia, "a", [ans("en:spelling", i % 3 == 0) for i in range(14)])
    recent = mia.get("/api/dates").json()["progress"]["en:spelling"]["recent"]
    assert recent == [i % 3 == 0 for i in range(4, 14)]


def test_other_languages_and_odd_kinds_are_skipped(mia):
    state = send(mia, "k", [ans("fr:spelling", True), ans("en", True), ans("en:", True)]).json()
    assert state["progress"] == {}


def test_parents_see_his_dates(papa, mia):
    send(mia, "k", [ans("en:date-words", False)])
    seen = papa.get("/api/players/2/dates").json()
    assert seen["progress"]["en:date-words"] == {"recent": [False]}
    assert "seen" not in seen
    assert mia.get("/api/players/2/dates").status_code == 403
