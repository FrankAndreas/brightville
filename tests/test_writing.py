"""Schreiben on the server: her words and sentences (written by the parents), how well she knows each letter (three in
a row up or down) and how many new letters a day she may meet."""

from conftest import set_time

from app import db as database


def state(browser):
    return browser.get("/api/writing").json()


def introduce(browser, glyph, key=None):
    return browser.post("/api/writing/introduced", json={"glyph": glyph, "key": key or f"i-{glyph}"})


def write(browser, glyph, level, clean, key):
    return browser.post(
        "/api/writing/writes", json={"writes": [{"key": key, "glyph": glyph, "level": level, "clean": clean}]}
    )


def set_texts(browser, texts, person_id=2):
    return browser.put(f"/api/players/{person_id}/writing/texts", json={"texts": texts})


def put_letter(glyph, level, introduced_on="2026-11-11", person_id=2):
    with database.connect() as connection:
        connection.execute(
            "INSERT INTO writing_letters (person_id, glyph, level, streak, introduced_on) VALUES (?, ?, ?, 0, ?)",
            (person_id, glyph, level, introduced_on),
        )


def code(answer):
    return answer.json()["detail"]["code"]


def test_a_new_child_has_no_texts_and_two_new_letters(mia):
    assert state(mia) == {"texts": [], "letters": {}, "new_left_today": 2}


def test_parents_set_texts_normalized(papa, mia):
    answer = set_texts(papa, ["lena", "  ich  mag dich ", "ä"])
    assert answer.status_code == 200
    assert answer.json()["texts"] == ["LENA", "ICH MAG DICH", "Ä"]
    assert state(mia)["texts"] == ["LENA", "ICH MAG DICH", "Ä"]
    assert papa.get("/api/players/2/writing").json()["texts"] == ["LENA", "ICH MAG DICH", "Ä"]


def test_refused_texts(papa, mia):
    assert code(set_texts(papa, ["Grüße"])) == "letters"
    assert code(set_texts(papa, ["HALLO!"])) == "letters"
    assert code(set_texts(papa, ["  "])) == "empty"
    assert code(set_texts(papa, ["A" * 31])) == "too-long"
    assert set_texts(papa, ["A" * 30]).status_code == 200
    assert code(set_texts(papa, ["MIA", "mia"])) == "exists"
    assert code(set_texts(papa, [f"A{i}" for i in range(21)])) == "too-many"
    assert state(mia)["texts"] == ["A" * 30]


def test_only_parents_set_texts(mia):
    assert set_texts(mia, ["MIA"]).status_code == 403


def test_texts_for_someone_unknown(papa):
    assert set_texts(papa, ["MIA"], person_id=99).status_code == 404


def test_introducing_puts_a_letter_at_level_one(mia):
    after = introduce(mia, "L").json()
    assert after["letters"]["L"] == {"level": 1, "streak": 0, "practised_at": None}
    assert after["new_left_today"] == 1


def test_introducing_twice_is_once(mia):
    introduce(mia, "L")
    assert introduce(mia, "L", key="again").status_code == 200
    assert state(mia)["new_left_today"] == 1


def test_unknown_glyph(mia):
    answer = introduce(mia, "ß")
    assert answer.status_code == 404
    assert code(answer) == "unknown"


def test_two_new_letters_a_day_then_409(mia, monkeypatch):
    introduce(mia, "L")
    introduce(mia, "E")
    answer = introduce(mia, "N")
    assert answer.status_code == 409
    assert code(answer) == "no_new_today"
    set_time(monkeypatch, "2026-11-13 08:00")
    assert state(mia)["new_left_today"] == 2
    # The day's pace is set by the letters from before today: today's own new letters don't lower it
    assert introduce(mia, "N").status_code == 200
    assert state(mia)["new_left_today"] == 1
    assert introduce(mia, "O").status_code == 200
    assert code(introduce(mia, "P")) == "no_new_today"


def test_the_pace_of_a_day_with_three_weak_letters_from_before(mia):
    for g in "ABC":
        put_letter(g, 1)
    assert introduce(mia, "L").status_code == 200
    assert code(introduce(mia, "E")) == "no_new_today"


def test_pacing_holds_back(mia):
    for g in "ABC":
        put_letter(g, 1)
    assert state(mia)["new_left_today"] == 1
    for g in "DE":
        put_letter(g, 1)
    assert state(mia)["new_left_today"] == 0
    assert code(introduce(mia, "L")) == "no_new_today"


def level(browser, glyph):
    return state(browser)["letters"][glyph]


def test_three_clean_up_three_bumpy_down(mia):
    introduce(mia, "L")
    for i in range(3):
        write(mia, "L", 1, True, f"c{i}")
    assert level(mia, "L")["level"] == 2
    assert level(mia, "L")["streak"] == 0
    for i in range(3):
        write(mia, "L", 2, False, f"b{i}")
    assert level(mia, "L")["level"] == 1
    for i in range(3):
        write(mia, "L", 1, False, f"bb{i}")
    assert level(mia, "L")["level"] == 1
    write(mia, "L", 1, True, "x1")
    write(mia, "L", 1, True, "x2")
    write(mia, "L", 1, False, "x3")
    assert level(mia, "L") == {"level": 1, "streak": -1, "practised_at": "2026-11-12T10:00:00+01:00"}


def test_known_is_the_top(mia):
    put_letter("M", 4)
    for i in range(3):
        write(mia, "M", 4, True, f"k{i}")
    assert level(mia, "M")["level"] == 4


def test_writes_at_another_level_or_for_new_letters_are_ignored(mia):
    introduce(mia, "L")
    for i in range(3):
        write(mia, "L", 2, True, f"w{i}")
    assert level(mia, "L") == {"level": 1, "streak": 0, "practised_at": None}
    assert write(mia, "Q", 1, True, "q").status_code == 200
    assert "Q" not in state(mia)["letters"]


def test_a_write_counts_once_per_key(mia):
    introduce(mia, "L")
    for _ in range(3):
        write(mia, "L", 1, True, "same")
    assert level(mia, "L")["streak"] == 1


def test_several_writes_in_one_request(mia):
    introduce(mia, "L")
    writes = [{"key": f"k{i}", "glyph": "L", "level": 1, "clean": True} for i in range(3)]
    after = mia.post("/api/writing/writes", json={"writes": writes}).json()
    assert after["letters"]["L"]["level"] == 2


def test_each_child_has_their_own(papa, mia, family_hub):
    from conftest import as_person

    introduce(mia, "L")
    set_texts(papa, ["MIA"])
    ben = as_person("Ben")
    assert state(ben) == {"texts": [], "letters": {}, "new_left_today": 2}
