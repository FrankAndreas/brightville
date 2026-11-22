"""The Oberstufe's vocabulary: his own lists (per language) and how well he knows each word (spaced repetition)."""

from datetime import date

import pytest

from conftest import as_person

TODAY = date(2026, 11, 12)


def words(n, side=""):
    return [{"de": f"Wort {i}{side}", "foreign": f"word {i}"} for i in range(n)]


def new_list(who, lang="en", name="Unit 3", n=3):
    return who.post("/api/vocab/lists", json={"lang": lang, "name": name, "words": words(n)})


@pytest.mark.parametrize(
    "box, right, expected",
    [
        (0, True, (1, "2026-11-13")),
        (1, True, (2, "2026-11-14")),
        (2, True, (3, "2026-11-16")),
        (3, True, (4, "2026-11-20")),
        (4, True, (5, "2026-11-28")),
        (5, True, (5, "2026-12-14")),
        (4, False, (1, "2026-11-13")),
        (0, False, (1, "2026-11-13")),
    ],
)
def test_next_box_follows_the_table(box, right, expected):
    from app import vocab

    assert vocab.next_box(box, right, TODAY) == expected


def test_a_list_is_made_changed_and_deleted(mia):
    made = new_list(mia)
    assert made.status_code == 200
    body = made.json()
    assert body["lang"] == "en" and body["name"] == "Unit 3" and len(body["words"]) == 3
    changed = mia.put(f"/api/vocab/lists/{body['id']}", json={"lang": "en", "name": "Unit 4", "words": words(2)})
    assert changed.json()["name"] == "Unit 4" and len(changed.json()["words"]) == 2
    assert [x["name"] for x in mia.get("/api/vocab").json()["lists"]] == ["Unit 4"]
    deleted = mia.delete(f"/api/vocab/lists/{body['id']}")
    assert deleted.status_code == 200 and deleted.json()["lists"] == []
    assert mia.get("/api/vocab").json()["lists"] == []


def test_lists_are_his_own(mia, family_hub):
    ben = as_person("Ben")
    made = new_list(mia).json()
    assert ben.get("/api/vocab").json()["lists"] == []
    assert (
        ben.put(f"/api/vocab/lists/{made['id']}", json={"lang": "en", "name": "x", "words": words(1)}).status_code
        == 404
    )
    assert ben.delete(f"/api/vocab/lists/{made['id']}").status_code == 404
    assert len(mia.get("/api/vocab").json()["lists"]) == 1


def code(answer):
    return answer.status_code, answer.json()["detail"]["code"]


def test_list_limits(mia):
    for i in range(30):
        assert new_list(mia, name=f"L{i}", n=1).status_code == 200
    assert code(new_list(mia, name="L30", n=1)) == (422, "too-many")
    assert new_list(mia, lang="fr", name="F", n=1).status_code == 200
    assert code(new_list(mia, lang="fr", n=61)) == (422, "too-long")
    long = mia.post("/api/vocab/lists", json={"lang": "fr", "name": "x", "words": [{"de": "a" * 61, "foreign": "b"}]})
    assert code(long) == (422, "too-long")
    assert code(mia.post("/api/vocab/lists", json={"lang": "fr", "name": "x" * 41, "words": words(1)})) == (
        422,
        "too-long",
    )
    assert code(mia.post("/api/vocab/lists", json={"lang": "fr", "name": "  ", "words": words(1)})) == (422, "empty")
    assert code(mia.post("/api/vocab/lists", json={"lang": "fr", "name": "x", "words": []})) == (422, "empty")
    blank = mia.post("/api/vocab/lists", json={"lang": "fr", "name": "x", "words": [{"de": " ", "foreign": "b"}]})
    assert code(blank) == (422, "empty")
    assert mia.post("/api/vocab/lists", json={"lang": "de", "name": "x", "words": words(1)}).status_code == 422


def test_results_move_boxes_once(mia):
    sent = {"key": "k1", "lang": "en", "answers": [{"word": "en:travel:station", "right": True}]}
    state = mia.post("/api/vocab/results", json=sent).json()
    assert state["progress"]["en:travel:station"] == {"box": 1, "due": "2026-11-13"}
    assert "k1" in state["seen"]
    again = mia.post("/api/vocab/results", json=sent).json()
    assert again["progress"]["en:travel:station"] == {"box": 1, "due": "2026-11-13"}
    wrong = mia.post(
        "/api/vocab/results",
        json={"key": "k2", "lang": "en", "answers": [{"word": "en:travel:station", "right": False}]},
    ).json()
    assert wrong["progress"]["en:travel:station"] == {"box": 1, "due": "2026-11-13"}


def test_results_never_cross_languages(mia):
    state = mia.post(
        "/api/vocab/results", json={"key": "k", "lang": "en", "answers": [{"word": "fr:travel:gare", "right": True}]}
    ).json()
    assert state["progress"] == {}


def test_parents_see_his_vocab(papa, mia):
    new_list(mia)
    mia.post(
        "/api/vocab/results", json={"key": "k", "lang": "en", "answers": [{"word": "en:own:word 0", "right": True}]}
    )
    seen = papa.get("/api/players/2/vocab").json()
    assert [x["name"] for x in seen["lists"]] == ["Unit 3"]
    assert seen["progress"]["en:own:word 0"]["box"] == 1
    assert mia.get("/api/players/2/vocab").status_code == 403
