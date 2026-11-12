import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest  # noqa: E402
from family_hub_client.fake import FakeHub  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import clock, hub  # noqa: E402
from app.main import app  # noqa: E402

# Changes carry this header, as the game's own page sends it
CSRF = {"X-Requested-With": "brightville"}


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    """Every test gets a database of its own, a hub address and a fixed clock."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("HUB_URL", "http://hub.test")
    monkeypatch.setenv("HUB_PUBLIC_URL", "https://home.local.example")
    monkeypatch.delenv("LOCAL_PEOPLE", raising=False)
    monkeypatch.delenv("LOCAL_MODE", raising=False)
    monkeypatch.delenv("TZ", raising=False)
    set_time(monkeypatch, "2026-11-12 10:00")


def set_time(monkeypatch, text: str) -> None:
    moment = datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo("Europe/Zurich"))
    monkeypatch.setattr(clock, "now", lambda: moment)


@pytest.fixture
def family_hub(monkeypatch):
    """A fake family hub (the hub client's own) with a parent and two children."""
    fake = FakeHub(hub.client)
    monkeypatch.setattr(hub.client, "transport", fake)
    fake.add("Papa", "PARENT", color="#3366cc")
    fake.add("Mia", "CHILD", color="#ff66aa")
    fake.add("Ben", "CHILD")
    yield fake
    hub.client.forget()


@pytest.fixture
def client():
    return TestClient(app)


def as_person(name: str) -> TestClient:
    """A browser logged in at the hub as this person."""
    browser = TestClient(app)
    browser.cookies.set("hub_session", f"tok-{name}")
    browser.headers.update(CSRF)
    return browser


@pytest.fixture
def mia(family_hub):
    return as_person("Mia")


@pytest.fixture
def papa(family_hub):
    return as_person("Papa")
