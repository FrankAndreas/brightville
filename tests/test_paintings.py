import base64

from conftest import as_person

from app.paintings import MAX_IMAGE_BYTES, MAX_PAINTINGS

PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"x" * 100).decode()
JPEG = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"y" * 50).decode()


def keep(browser, pid, image=PNG, thumb=JPEG):
    return browser.put(f"/api/paintings/{pid}", json={"image": image, "thumb": thumb})


def test_a_child_keeps_a_painting_and_finds_it_again(mia):
    assert keep(mia, "p-1").status_code == 200
    listing = mia.get("/api/paintings").json()
    assert [p["id"] for p in listing] == ["p-1"]
    assert isinstance(listing[0]["updated"], int)
    image = mia.get("/api/paintings/p-1/image")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.content.startswith(b"\x89PNG")
    thumb = mia.get("/api/paintings/p-1/thumb")
    assert thumb.headers["content-type"] == "image/jpeg"
    # Private to whoever is logged in, and never stale after painting further
    assert "private" in image.headers["cache-control"]
    assert "no-cache" in image.headers["cache-control"]


def test_newest_first_and_painting_further_moves_it_to_the_front(mia):
    keep(mia, "a")
    keep(mia, "b")
    keep(mia, "a", image=PNG.replace("eHh4", "enp6"))
    assert [p["id"] for p in mia.get("/api/paintings").json()] == ["a", "b"]


def test_each_child_sees_only_their_own(mia, family_hub):
    keep(mia, "mine")
    ben = as_person("Ben")
    assert ben.get("/api/paintings").json() == []
    assert ben.get("/api/paintings/mine/image").status_code == 404
    # The same name for Ben is a painting of his own, and Mia's stays as it was
    keep(ben, "mine", image=PNG.replace("eHh4", "enp6"))
    assert mia.get("/api/paintings/mine/image").content.startswith(b"\x89PNG")
    assert ben.delete("/api/paintings/mine").status_code == 200
    assert [p["id"] for p in mia.get("/api/paintings").json()] == ["mine"]


def test_only_the_newest_are_kept(mia):
    for i in range(MAX_PAINTINGS + 2):
        keep(mia, f"p{i:02d}")
    ids = [p["id"] for p in mia.get("/api/paintings").json()]
    assert len(ids) == MAX_PAINTINGS
    assert "p00" not in ids and "p01" not in ids
    assert ids[0] == f"p{MAX_PAINTINGS + 1:02d}"


def test_a_child_deletes_a_painting(mia):
    keep(mia, "p")
    assert mia.delete("/api/paintings/p").status_code == 200
    assert mia.get("/api/paintings").json() == []
    assert mia.delete("/api/paintings/p").status_code == 404


def test_only_pictures_are_taken(mia):
    assert keep(mia, "p", image="data:text/html;base64,PGI+").status_code == 422
    assert keep(mia, "p", image="data:image/png;base64,not base64!").status_code == 422
    assert keep(mia, "p", image="data:image/png;base64," + base64.b64encode(b"GIF89a").decode()).status_code == 422
    assert keep(mia, "p", thumb="https://example.com/x.jpg").status_code == 422
    assert keep(mia, "../etc", image=PNG).status_code in (404, 422)
    assert keep(mia, "x" * 65).status_code == 422
    assert mia.get("/api/paintings").json() == []


def test_a_painting_too_large_is_refused(mia):
    big = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"x" * MAX_IMAGE_BYTES).decode()
    answer = keep(mia, "big", image=big)
    assert answer.status_code == 413
    assert answer.json()["detail"]["code"] == "too_large"


def test_paintings_need_a_login(family_hub):
    from conftest import CSRF
    from fastapi.testclient import TestClient

    from app.main import app

    stranger = TestClient(app)
    stranger.headers.update(CSRF)
    assert stranger.get("/api/paintings").status_code == 401
    assert stranger.get("/api/paintings/p/image").status_code == 401
