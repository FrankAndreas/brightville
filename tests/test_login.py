import pytest
from conftest import CSRF, as_person
from fastapi.testclient import TestClient

from app.main import app


def test_health_needs_no_login(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_without_a_login_the_answer_says_where_to_log_in(client, family_hub):
    answer = client.get("/api/me")
    assert answer.status_code == 401
    assert answer.json()["detail"] == {"code": "not_logged_in", "login_url": "https://home.local.example/?next="}


def test_a_made_up_cookie_is_no_login(family_hub):
    assert as_person("Nobody").get("/api/me").status_code == 401


def test_me_says_who_is_logged_in(mia):
    answer = mia.get("/api/me")
    assert answer.status_code == 200
    assert answer.json() == {
        "mode": "hub",
        "person": {"id": 2, "name": "Mia", "role": "CHILD", "color": "#ff66aa"},
        "people": [],
        "login_url": "https://home.local.example/?next=",
        "logout_url": "https://home.local.example/logout?next=",
    }


def test_a_bearer_token_logs_in_too(family_hub):
    answer = TestClient(app).get("/api/me", headers={"Authorization": "Bearer tok-Mia"})
    assert answer.json()["person"]["name"] == "Mia"


def test_someone_without_access_is_told_so(family_hub):
    family_hub.remove_access("Mia")
    answer = as_person("Mia").get("/api/me")
    assert answer.status_code == 403
    assert answer.json()["detail"]["code"] == "no_access"


def test_nobody_gets_in_while_the_hub_is_down(mia, family_hub):
    family_hub.down = True
    family_hub.client.forget()
    answer = mia.get("/api/state")
    assert answer.status_code == 503
    assert answer.json()["detail"]["code"] == "hub_unavailable"


def test_requests_from_outside_are_refused(mia):
    answer = mia.get("/api/me", headers={"Cf-Connecting-Ip": "203.0.113.9"})
    assert answer.status_code == 403
    assert answer.json()["detail"]["code"] == "home_only"
    assert mia.get("/health", headers={"Cf-Connecting-Ip": "203.0.113.9"}).status_code == 403


def test_a_change_needs_the_header_another_site_cannot_send(family_hub):
    browser = TestClient(app)
    browser.cookies.set("hub_session", "tok-Mia")
    answer = browser.post("/api/visits", json={"building": "school", "stars": 3, "key": "a"})
    assert answer.status_code == 403
    assert answer.json()["detail"]["code"] == "csrf"
    assert (
        browser.post("/api/visits", json={"building": "school", "stars": 3, "key": "a"}, headers=CSRF).status_code
        == 200
    )


def test_a_login_in_its_last_week_asks_to_be_renewed(mia, family_hub):
    assert "X-Hub-Renew" not in mia.get("/api/me").headers
    family_hub.renewing.add("Mia")
    family_hub.client.forget()
    assert mia.get("/api/me").headers["X-Hub-Renew"] == "1"


def test_a_new_name_or_role_in_the_hub_shows_at_once(mia, family_hub):
    mia.get("/api/me")
    family_hub.rename("Mia", "Maya")
    browser = as_person("Maya")
    assert browser.get("/api/me").json()["person"]["name"] == "Maya"


def test_the_database_can_be_named_as_in_the_other_family_apps(tmp_path, monkeypatch):
    from app import db

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/other/game.db")
    assert db.path() == tmp_path / "other" / "game.db"
    assert db.path().parent.is_dir()


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("post", "/api/plays", {"building": "arcade", "key": "p"}),
        ("post", "/api/playtime", {"seconds": 5}),
        ("put", "/api/players/2", {"daily_goal": 1, "play_minutes": None, "stars": 1}),
    ],
)
def test_every_change_needs_the_header(family_hub, method, path, body):
    browser = TestClient(app)
    browser.cookies.set("hub_session", "tok-Papa")
    answer = getattr(browser, method)(path, json=body)
    assert answer.status_code == 403
    assert answer.json()["detail"]["code"] == "csrf"


def test_an_ended_parent_login_does_not_hide_the_children(papa, family_hub):
    assert len(papa.get("/api/players").json()) == 3
    from app import auth, db, hub

    family_hub.down = False
    # Ask the hub again rather than the copy of a moment ago
    auth.forget_people()
    hub.client.transport = lambda path, headers: (403, None) if "/people" in path else family_hub(path, headers)
    connection = db.connect()
    try:
        from starlette.requests import Request

        request = Request({"type": "http", "headers": [(b"authorization", b"Bearer tok-Papa")], "method": "GET"})
        auth.refresh_people(request, connection)
        assert connection.execute("SELECT COUNT(*) FROM people WHERE active = 1").fetchone()[0] == 3
    finally:
        connection.close()
