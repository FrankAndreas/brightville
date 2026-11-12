"""The time at home. Tests put a fixed moment in `now`'s place."""

import os
from datetime import datetime
from zoneinfo import ZoneInfo


def zone() -> ZoneInfo:
    return ZoneInfo(os.getenv("TZ") or "Europe/Zurich")


def now() -> datetime:
    return datetime.now(zone())


def today() -> str:
    """The calendar day at home, 'YYYY-MM-DD': the daily goal and the play time start over when it changes."""
    return now().astimezone(zone()).strftime("%Y-%m-%d")
