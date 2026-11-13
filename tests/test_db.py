import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


def test_the_goal_days_from_before_they_were_kept_are_written_down_once(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    old = sqlite3.connect(tmp_path / "brightville.db")
    for step in db.MIGRATIONS[:5]:
        old.executescript(step)
    # Mia (goal 3): three visits on the 10th, one on the 11th. Ben (no row in players: the default 2): two on the 10th
    old.execute("INSERT INTO players (person_id, daily_goal) VALUES (2, 3)")
    visits = [(2, "10")] * 3 + [(2, "11"), (3, "10"), (3, "10")]
    for i, (person, day) in enumerate(visits):
        old.execute(
            "INSERT INTO events (person_id, key, kind, building, stars, at) VALUES (?, ?, 'visit', 'school', 3, ?)",
            (person, f"k{i}", f"2026-11-{day}T16:00:00+01:00"),
        )
    # A round bought is no learning visit
    old.execute(
        "INSERT INTO events (person_id, key, kind, building, stars, at) VALUES (2, 'p', 'play', 'arcade', -3, ?)",
        ("2026-11-11T17:00:00+01:00",),
    )
    old.execute("PRAGMA user_version = 5")
    old.commit()
    old.close()

    connection = db.connect()
    rows = connection.execute("SELECT person_id, day, goal FROM goal_days ORDER BY person_id, day").fetchall()
    assert [tuple(r) for r in rows] == [(2, "2026-11-10", 3), (3, "2026-11-10", 2)]
    connection.close()


def test_a_migration_is_split_where_sqlite_says_a_statement_ends():
    script = """
CREATE TABLE a (x TEXT DEFAULT 'semi;colon'); CREATE TABLE b (y INTEGER);
CREATE TRIGGER t AFTER INSERT ON a BEGIN
    INSERT INTO b (y) VALUES (1);
END;
"""
    found = db.statements(script)
    assert [s.split()[1] for s in found] == ["TABLE", "TABLE", "TRIGGER"]
    assert "'semi;colon'" in found[0]
    with pytest.raises(ValueError):
        db.statements("CREATE TABLE c (z TEXT)")


def test_the_database_remembers_the_mode_it_was_made_in(monkeypatch):
    monkeypatch.delenv("HUB_URL")
    monkeypatch.setenv("LOCAL_MODE", "1")
    with TestClient(app):
        pass
    # The same database, now with the hub: its people's numbers don't match the hub's, so the server doesn't start
    monkeypatch.setenv("HUB_URL", "http://hub.test")
    monkeypatch.delenv("LOCAL_MODE")
    with pytest.raises(RuntimeError):
        with TestClient(app):
            pass
    # Back as it was made: fine
    monkeypatch.delenv("HUB_URL")
    monkeypatch.setenv("LOCAL_MODE", "1")
    with TestClient(app):
        pass


def test_a_database_from_stage_4_is_brought_up_to_date_and_keeps_everything(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    old = sqlite3.connect(tmp_path / "brightville.db")
    old.executescript(db.MIGRATIONS[0])
    old.execute("INSERT INTO players (person_id, stars) VALUES (2, 41)")
    old.execute("PRAGMA user_version = 1")
    old.commit()
    old.close()

    connection = db.connect()
    assert connection.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert connection.execute("SELECT stars FROM players WHERE person_id = 2").fetchone()[0] == 41
    assert connection.execute("SELECT COUNT(*) FROM films").fetchone()[0] == 0
    connection.close()
    # A second start changes nothing
    again = db.connect()
    assert again.execute("SELECT stars FROM players WHERE person_id = 2").fetchone()[0] == 41
