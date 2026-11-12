"""Who is playing. With the family hub: the hub's login, as in the sibling apps (the cookie `hub_session`, set for
local.<domain>, or the same token as a Bearer). Without: the person picked on the page (local.py), kept in a cookie.

Requests from outside never get this far: main.py refuses everything that carries Cf-Connecting-Ip."""

import logging
import sqlite3
from collections.abc import Iterator
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, status

from . import db as database
from . import hub, local, people
from .people import Person

logger = logging.getLogger(__name__)

HUB_COOKIE = "hub_session"
LOCAL_COOKIE = "bv_person"
# A change must carry this header: another site can make the browser send the cookie (sibling apps share the site),
# but not a custom header without this app allowing it
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "brightville"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
RENEW_HEADER = "X-Hub-Renew"


def error(code: int, name: str, **more: object) -> HTTPException:
    return HTTPException(code, detail={"code": name, **more})


def get_db() -> Iterator[sqlite3.Connection]:
    connection = database.connect()
    try:
        yield connection
    finally:
        connection.close()


def hub_login(request: Request) -> Optional[hub.Login]:
    scheme, _, value = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() == "bearer" and value.strip():
        return hub.Login(value.strip())
    cookie = request.cookies.get(HUB_COOKIE)
    return hub.Login(cookie) if cookie else None


def login_url() -> Optional[str]:
    """Where the page sends the browser to log in; it adds its own address after `next=`."""
    return f"{hub.client.public_url()}/?next=" if hub.enabled() else None


def logout_url() -> Optional[str]:
    return f"{hub.client.public_url()}/logout?next=" if hub.enabled() else None


def local_person(request: Request) -> Optional[Person]:
    chosen = request.cookies.get(LOCAL_COOKIE, "")
    return next((Person.of(p) for p in local.people() if str(p.id) == chosen), None)


def check_configured() -> None:
    """Without HUB_URL only an explicit LOCAL_MODE=1 lets anyone in.

    A forgotten setting must not open the parents' page."""
    if not hub.enabled() and not local.enabled():
        raise error(status.HTTP_503_SERVICE_UNAVAILABLE, "not_configured")


def check_csrf(request: Request) -> None:
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise error(status.HTTP_403_FORBIDDEN, "csrf")


def current_person(request: Request, response: Response, db: sqlite3.Connection = Depends(get_db)) -> Person:
    check_configured()
    check_csrf(request)
    if not hub.enabled():
        person = local_person(request)
        if person is None:
            raise error(status.HTTP_401_UNAUTHORIZED, "not_logged_in", login_url=None)
        people.remember(db, person)
        return person
    login = hub_login(request)
    if login is None:
        raise error(status.HTTP_401_UNAUTHORIZED, "not_logged_in", login_url=login_url())
    try:
        session = hub.client.session(login)
    except hub.HubUnavailable as problem:
        logger.warning("The family hub can't be reached (%s)", problem)
        raise error(status.HTTP_503_SERVICE_UNAVAILABLE, "hub_unavailable") from None
    if session.person is None:
        raise error(status.HTTP_401_UNAUTHORIZED, "not_logged_in", login_url=login_url())
    if not session.access:
        raise error(status.HTTP_403_FORBIDDEN, "no_access")
    if session.renew:
        # The hub login is in its last week: the page sends the browser once through the hub, which renews it
        response.headers[RENEW_HEADER] = "1"
    person = Person.of(session.person)
    people.remember(db, person)
    return person


def parent(person: Person = Depends(current_person)) -> Person:
    if not person.is_parent():
        raise error(status.HTTP_403_FORBIDDEN, "parents_only")
    return person


def refresh_people(request: Request, db: sqlite3.Connection) -> None:
    """Brings the copy of who may play up to date, for the parent area."""
    if not hub.enabled():
        people.replace_all(db, (Person.of(p) for p in local.people()))
        return
    login = hub_login(request)
    if login is None:
        return
    try:
        everyone = hub.client.fetch_people(login)
        # An empty answer is a login that just ended, not a family that left: keep the list as it is
        if everyone:
            people.replace_all(db, (Person.of(p) for p in everyone))
    except hub.HubUnavailable as problem:
        logger.warning("The family hub can't be reached (%s)", problem)
        raise error(status.HTTP_503_SERVICE_UNAVAILABLE, "hub_unavailable") from None
