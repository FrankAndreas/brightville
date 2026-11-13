import sqlite3

from app import db


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
