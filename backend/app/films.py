"""The Cinema's films: YouTube films the parents chose, the same list for every child."""

import re
import sqlite3
from typing import Optional
from urllib.parse import parse_qs, urlparse

from .db import writing

MAX_FILMS = 30

_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}
_PATHS = ("/shorts/", "/embed/", "/live/", "/v/")


class Refused(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def youtube_id(url: str) -> Optional[str]:
    """The film in a YouTube link of any common form, or None for anything else."""
    text = url.strip()
    if not text:
        return None
    if "://" not in text:
        text = "https://" + text
    parts = urlparse(text)
    if parts.scheme not in ("http", "https"):
        return None
    host = (parts.hostname or "").lower()
    found: Optional[str] = None
    if host == "youtu.be":
        found = parts.path.strip("/").split("/")[0]
    elif host in _HOSTS:
        if parts.path == "/watch":
            found = (parse_qs(parts.query).get("v") or [""])[0]
        else:
            for prefix in _PATHS:
                if parts.path.startswith(prefix):
                    found = parts.path[len(prefix) :].split("/")[0]
    return found if found and _ID.match(found) else None


def listing(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute("SELECT id, youtube_id, title FROM films ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def add(db: sqlite3.Connection, url: str, title: str) -> dict:
    film = youtube_id(url)
    if film is None:
        raise Refused("not_youtube")
    with writing(db):
        if db.execute("SELECT 1 FROM films WHERE youtube_id = ?", (film,)).fetchone():
            raise Refused("already_there")
        if db.execute("SELECT COUNT(*) FROM films").fetchone()[0] >= MAX_FILMS:
            raise Refused("too_many")
        cursor = db.execute("INSERT INTO films (youtube_id, title) VALUES (?, ?)", (film, title.strip()))
        return {"id": cursor.lastrowid, "youtube_id": film, "title": title.strip()}


def remove(db: sqlite3.Connection, film_id: int) -> bool:
    with writing(db):
        return db.execute("DELETE FROM films WHERE id = ?", (film_id,)).rowcount > 0
