"""Each child's paintings from Malen, so the gallery is the same on every device. Only the newest MAX_PAINTINGS stay."""

import base64
import binascii
import re
import sqlite3
import time
from typing import Optional

from .db import writing

MAX_PAINTINGS = 30
MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_THUMB_BYTES = 300 * 1024

ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_DATA_URL = re.compile(r"^data:(image/png|image/jpeg);base64,([A-Za-z0-9+/=\s]+)$")
# What the bytes must start with, so a picture is a picture whatever the browser called it
_MAGIC = {"image/png": b"\x89PNG\r\n\x1a\n", "image/jpeg": b"\xff\xd8\xff"}


class Refused(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def picture(data_url: str, limit: int) -> tuple[bytes, str]:
    """The bytes and type of a PNG or JPEG data URL; Refused for anything else or anything too large."""
    match = _DATA_URL.match(data_url)
    if not match:
        raise Refused("not_a_picture")
    kind, text = match.groups()
    # Base64 is a third larger than what it holds: a quick refusal before decoding a huge string
    if len(text) > limit * 4 // 3 + 16:
        raise Refused("too_large")
    try:
        raw = base64.b64decode(text, validate=False)
    except binascii.Error, ValueError:
        raise Refused("not_a_picture") from None
    if len(raw) > limit:
        raise Refused("too_large")
    if not raw.startswith(_MAGIC[kind]):
        raise Refused("not_a_picture")
    return raw, kind


def listing(db: sqlite3.Connection, person_id: int) -> list[dict]:
    rows = db.execute(
        "SELECT id, updated FROM paintings WHERE person_id = ? ORDER BY updated DESC, rowid DESC", (person_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def keep(db: sqlite3.Connection, person_id: int, painting_id: str, image: str, thumb: str) -> dict:
    image_bytes, image_type = picture(image, MAX_IMAGE_BYTES)
    thumb_bytes, thumb_type = picture(thumb, MAX_THUMB_BYTES)
    with writing(db):
        newest = db.execute("SELECT MAX(updated) FROM paintings WHERE person_id = ?", (person_id,)).fetchone()[0]
        # Strictly newer than every other painting of this child, even within one millisecond
        updated = max(int(time.time() * 1000), (newest or 0) + 1)
        db.execute(
            "INSERT INTO paintings (person_id, id, image, image_type, thumb, thumb_type, updated)"
            " VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (person_id, id) DO UPDATE SET image = excluded.image,"
            " image_type = excluded.image_type, thumb = excluded.thumb, thumb_type = excluded.thumb_type,"
            " updated = excluded.updated",
            (person_id, painting_id, image_bytes, image_type, thumb_bytes, thumb_type, updated),
        )
        db.execute(
            "DELETE FROM paintings WHERE person_id = ? AND id NOT IN"
            " (SELECT id FROM paintings WHERE person_id = ? ORDER BY updated DESC LIMIT ?)",
            (person_id, person_id, MAX_PAINTINGS),
        )
    return {"id": painting_id, "updated": updated}


def part(db: sqlite3.Connection, person_id: int, painting_id: str, which: str) -> Optional[tuple[bytes, str]]:
    column, kind = ("image", "image_type") if which == "image" else ("thumb", "thumb_type")
    row = db.execute(
        f"SELECT {column}, {kind} FROM paintings WHERE person_id = ? AND id = ?", (person_id, painting_id)
    ).fetchone()
    return (bytes(row[0]), row[1]) if row else None


def remove(db: sqlite3.Connection, person_id: int, painting_id: str) -> bool:
    with writing(db):
        return db.execute("DELETE FROM paintings WHERE person_id = ? AND id = ?", (person_id, painting_id)).rowcount > 0
