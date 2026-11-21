"""The headers nginx puts on every answer (security-headers.conf): the camera and the microphone, which the game
uses, stay allowed for its own page; location stays forbidden."""

import re
from pathlib import Path

HEADERS = (Path(__file__).resolve().parents[1] / "security-headers.conf").read_text(encoding="utf-8")


def permissions() -> dict[str, str]:
    found = re.search(r'add_header Permissions-Policy "(.*)" always;', HEADERS)
    assert found, "no Permissions-Policy line"
    policy = found.group(1).replace('\\"', '"')
    return {
        name.strip(): allowed.strip() for name, allowed in (part.split("=", 1) for part in re.split(r",\s*", policy))
    }


def test_the_camera_and_microphone_are_allowed_for_the_game_itself():
    # Yoga watches her through the camera; the Trommelhaus hears her claps
    assert permissions()["camera"] == "(self)"
    assert permissions()["microphone"] == "(self)"


def test_location_stays_forbidden():
    assert permissions()["geolocation"] == "()"
