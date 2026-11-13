"""The family hub (FrankAndreas/family-hub): who is logged in, and who may play (family-hub "For apps").

The hub's own client package, set up with this app's key. Without HUB_URL the game runs without a hub: see local.py."""

import os

from family_hub_client import (  # noqa: F401
    CACHE_SECONDS,
    TIMEOUT_SECONDS,
    HubClient,
    HubPerson,
    HubUnavailable,
    Login,
    Session,
)

client = HubClient(default_app_key="brightville")


def enabled() -> bool:
    return bool(os.getenv("HUB_URL"))
