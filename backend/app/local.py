"""Playing without the family hub, for trying the game out: the people come from LOCAL_PEOPLE and whoever opens the
page picks one, with no PIN. Anybody can pick a parent, so this is not for a NAS the children can reach."""

import os
from dataclasses import dataclass

DEFAULT_PEOPLE = "Kind:CHILD,Eltern:PARENT"
COLORS = ["#ff9a3c", "#4f8fe8", "#4bd37b", "#e86fb0", "#a58bf0", "#f2c230"]
ROLES = {"CHILD", "PARENT"}


@dataclass(frozen=True)
class LocalPerson:
    id: int
    name: str
    role: str
    color: str


def people() -> list[LocalPerson]:
    """The people of LOCAL_PEOPLE ("Name:ROLE,..."), numbered from 1 in the order given. Entries without a name or
    with an unknown role are left out."""
    found: list[LocalPerson] = []
    for entry in (os.getenv("LOCAL_PEOPLE") or DEFAULT_PEOPLE).split(","):
        name, _, role = (part.strip() for part in entry.partition(":"))
        role = role.upper()
        if name and role in ROLES:
            number = len(found) + 1
            found.append(LocalPerson(number, name, role, COLORS[(number - 1) % len(COLORS)]))
    return found
