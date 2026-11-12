import pytest
from conftest import CSRF
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def browser(monkeypatch):
    monkeypatch.delenv("HUB_URL")
    monkeypatch.delenv("HUB_PUBLIC_URL")
    monkeypatch.setenv("LOCAL_MODE", "1")
    browser = TestClient(app)
    browser.headers.update(CSRF)
    return browser


def test_without_a_hub_nobody_plays_until_someone_is_chosen(browser):
    answer = browser.get("/api/me")
    assert answer.status_code == 200
    body = answer.json()
    assert body["mode"] == "local"
    assert body["person"] is None
    assert body["logout_url"] is None
    assert body["login_url"] is None
    assert [(p["id"], p["name"], p["role"]) for p in body["people"]] == [(1, "Kind", "CHILD"), (2, "Eltern", "PARENT")]
    assert all(p["color"].startswith("#") for p in body["people"])
    assert browser.get("/api/state").status_code == 401


def test_choosing_someone_logs_them_in(browser):
    assert browser.post("/api/local/choose", json={"id": 1}).status_code == 200
    assert browser.get("/api/me").json()["person"] == {"id": 1, "name": "Kind", "role": "CHILD", "color": "#ff9a3c"}
    assert browser.get("/api/state").json()["stars"] == 0
    browser.post("/api/local/choose", json={"id": 2})
    assert browser.get("/api/me").json()["person"]["role"] == "PARENT"


def test_choosing_someone_unknown_is_refused(browser):
    assert browser.post("/api/local/choose", json={"id": 9}).status_code == 404
    assert browser.get("/api/me").json()["person"] is None


def test_the_people_can_be_named(browser, monkeypatch):
    monkeypatch.setenv("LOCAL_PEOPLE", "Mia:CHILD, Ben:child ,Mama:PARENT,:CHILD,Oops:BOSS")
    names = [(p["name"], p["role"]) for p in browser.get("/api/me").json()["people"]]
    assert names == [("Mia", "CHILD"), ("Ben", "CHILD"), ("Mama", "PARENT")]


def test_a_cookie_for_someone_no_longer_named_is_no_login(browser, monkeypatch):
    browser.post("/api/local/choose", json={"id": 2})
    monkeypatch.setenv("LOCAL_PEOPLE", "Mia:CHILD")
    assert browser.get("/api/me").json()["person"] is None


def test_the_local_parent_sees_the_children(browser):
    browser.post("/api/local/choose", json={"id": 2})
    assert [p["name"] for p in browser.get("/api/players").json()] == ["Kind", "Eltern"]


def test_without_a_hub_and_without_local_mode_nobody_gets_in(monkeypatch):
    monkeypatch.delenv("HUB_URL")
    browser = TestClient(app)
    browser.headers.update(CSRF)
    for answer in (
        browser.get("/api/me"),
        browser.get("/api/state"),
        browser.post("/api/local/choose", json={"id": 2}),
    ):
        assert answer.status_code == 503
        assert answer.json()["detail"]["code"] == "not_configured"


def test_choosing_needs_the_header_too(browser):
    del browser.headers["X-Requested-With"]
    assert browser.post("/api/local/choose", json={"id": 2}).status_code == 403


def test_with_a_hub_there_is_no_choosing(mia):
    assert mia.post("/api/local/choose", json={"id": 1}).status_code == 404
    assert mia.get("/api/me").json()["people"] == []
