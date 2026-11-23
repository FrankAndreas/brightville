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


def test_films_have_a_level_and_are_unique_per_level(papa, mia):
    assert add(papa, f"https://youtu.be/{ID}", "Lieder").json()["level"] == "kindergarten"
    his = papa.post("/api/films", json={"url": f"https://youtu.be/{ID}", "title": "Song", "level": "oberstufe"})
    assert his.status_code == 200 and his.json()["level"] == "oberstufe"
    again = papa.post("/api/films", json={"url": f"https://youtu.be/{ID}", "title": "X", "level": "oberstufe"})
    assert again.json()["detail"]["code"] == "already_there"
    assert [(f["title"], f["level"]) for f in mia.get("/api/films").json()] == [
        ("Lieder", "kindergarten"),
        ("Song", "oberstufe"),
    ]


def test_thirty_films_per_level(papa):
    for i in range(MAX_FILMS):
        assert add(papa, f"https://youtu.be/{i:011d}").status_code == 200
    assert add(papa, "https://youtu.be/zzzzzzzzzzz").json()["detail"]["code"] == "too_many"
    answer = papa.post("/api/films", json={"url": "https://youtu.be/zzzzzzzzzzz", "title": "", "level": "oberstufe"})
    assert answer.status_code == 200


def test_the_migration_keeps_existing_films_as_kindergarten(tmp_path, monkeypatch):
    import sqlite3

    from app import db as database

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    version = next(i for i, m in enumerate(database.MIGRATIONS) if "CREATE TABLE dates_progress" in m) + 1
    old = sqlite3.connect(tmp_path / "brightville.db")
    for step in database.MIGRATIONS[:version]:
        old.executescript(step)
    old.execute(
        "INSERT INTO films (id, youtube_id, title) VALUES (5, 'aaaaaaaaaaa', 'Tiere'), (9, 'bbbbbbbbbbb', 'Lieder')"
    )
    old.execute(f"PRAGMA user_version = {version}")
    old.commit()
    old.close()
    connection = database.connect()
    rows = connection.execute("SELECT id, youtube_id, title, level FROM films ORDER BY id").fetchall()
    assert [tuple(r) for r in rows] == [
        (5, "aaaaaaaaaaa", "Tiere", "kindergarten"),
        (9, "bbbbbbbbbbb", "Lieder", "kindergarten"),
    ]
    connection.close()


def test_the_migration_never_gives_a_deleted_film_id_again(tmp_path, monkeypatch):
    import sqlite3

    from app import db as database

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    version = next(i for i, m in enumerate(database.MIGRATIONS) if "CREATE TABLE dates_progress" in m) + 1
    old = sqlite3.connect(tmp_path / "brightville.db")
    for step in database.MIGRATIONS[:version]:
        old.executescript(step)
    for i in range(1, 6):
        old.execute("INSERT INTO films (youtube_id, title) VALUES (?, '')", (f"{i:011d}",))
    old.execute("DELETE FROM films WHERE id >= 4")
    old.execute(f"PRAGMA user_version = {version}")
    old.commit()
    old.close()
    connection = database.connect()
    from app import films

    assert films.add(connection, "https://youtu.be/zzzzzzzzzzz", "Neu")["id"] == 6
    connection.close()
