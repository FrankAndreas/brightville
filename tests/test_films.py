import pytest

from app.films import MAX_FILMS, youtube_id

ID = "dQw4w9WgXcQ"


def add(browser, url, title="Ein Film"):
    return browser.post("/api/films", json={"url": url, "title": title})


@pytest.mark.parametrize(
    "url",
    [
        f"https://www.youtube.com/watch?v={ID}",
        f"https://youtube.com/watch?v={ID}&t=42s",
        f"https://m.youtube.com/watch?feature=share&v={ID}",
        f"https://youtu.be/{ID}",
        f"https://youtu.be/{ID}?si=abc",
        f"https://www.youtube.com/shorts/{ID}",
        f"https://www.youtube.com/embed/{ID}",
        f"https://www.youtube-nocookie.com/embed/{ID}",
        f"https://www.youtube.com/live/{ID}",
        f"youtube.com/watch?v={ID}",
        f"  https://youtu.be/{ID}  ",
    ],
)
def test_reads_the_film_from_every_common_link(url):
    assert youtube_id(url) == ID


@pytest.mark.parametrize(
    "url",
    [
        "",
        "https://vimeo.com/12345",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
        f"https://evil.example/watch?v={ID}",
        f"https://youtube.com.evil.example/watch?v={ID}",
        f"javascript:alert(1)//youtu.be/{ID}",
    ],
)
def test_refuses_anything_else(url):
    assert youtube_id(url) is None


def test_a_parent_adds_films_and_everyone_sees_them_in_order(papa, mia):
    assert add(papa, f"https://youtu.be/{ID}", "Lieder").status_code == 200
    assert add(papa, "https://www.youtube.com/watch?v=aaaaaaaaaaa", "Tiere").status_code == 200
    films = mia.get("/api/films").json()
    assert [(f["youtube_id"], f["title"]) for f in films] == [(ID, "Lieder"), ("aaaaaaaaaaa", "Tiere")]
    assert all(isinstance(f["id"], int) for f in films)


def test_a_bad_link_is_refused_with_its_own_code(papa):
    answer = add(papa, "https://vimeo.com/1")
    assert answer.status_code == 422
    assert answer.json()["detail"]["code"] == "not_youtube"


def test_the_same_film_twice_is_kept_once(papa):
    add(papa, f"https://youtu.be/{ID}", "A")
    answer = add(papa, f"https://www.youtube.com/watch?v={ID}", "B")
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "already_there"
    assert len(papa.get("/api/films").json()) == 1


def test_a_film_without_a_name_gets_none(papa):
    add(papa, f"https://youtu.be/{ID}", "  ")
    assert papa.get("/api/films").json()[0]["title"] == ""


def test_the_list_is_limited(papa):
    for i in range(MAX_FILMS):
        assert add(papa, f"https://youtu.be/{i:011d}").status_code == 200
    answer = add(papa, f"https://youtu.be/{ID}")
    assert answer.status_code == 409
    assert answer.json()["detail"]["code"] == "too_many"


def test_a_parent_removes_a_film(papa, mia):
    add(papa, f"https://youtu.be/{ID}")
    film = papa.get("/api/films").json()[0]
    assert papa.delete(f"/api/films/{film['id']}").status_code == 200
    assert mia.get("/api/films").json() == []
    assert papa.delete(f"/api/films/{film['id']}").status_code == 404


def test_children_cannot_change_the_list(mia, papa):
    assert add(mia, f"https://youtu.be/{ID}").status_code == 403
    add(papa, f"https://youtu.be/{ID}")
    film = mia.get("/api/films").json()[0]
    assert mia.delete(f"/api/films/{film['id']}").status_code == 403


def test_the_list_needs_a_login(family_hub):
    from conftest import CSRF
    from fastapi.testclient import TestClient

    from app.main import app

    stranger = TestClient(app)
    stranger.headers.update(CSRF)
    assert stranger.get("/api/films").status_code == 401


def test_the_cinema_is_a_play_building(papa, mia):
    add(papa, f"https://youtu.be/{ID}")
    mia.post("/api/visits", json={"building": "school", "stars": 5, "key": "v1"})
    mia.post("/api/visits", json={"building": "school", "stars": 5, "key": "v2"})
    answer = mia.post("/api/plays", json={"building": "kino", "key": "k1"})
    assert answer.status_code == 200
    assert answer.json()["state"]["stars"] == 7
