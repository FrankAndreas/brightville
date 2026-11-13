"""Brightville's server: who is playing, their Stars and today's numbers, and the parents' settings."""

import asyncio
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Optional

from fastapi import Depends, FastAPI, Path, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import auth, films, game, hub, local, paintings, people, stickers, wardrobe
from . import db as database
from .auth import error, get_db
from .buildings import Building, all_buildings
from .people import Person

logger = logging.getLogger("uvicorn.error")


def check_mode() -> None:
    """Refuses to start on a database made in the other mode (db.claim_mode): the people's numbers wouldn't match."""
    mode = "hub" if hub.enabled() else "local" if local.enabled() else None
    if mode is None:
        return
    connection = database.connect()
    try:
        made_in = database.claim_mode(connection, mode)
    finally:
        connection.close()
    if made_in != mode:
        logger.error(
            "The database %s was made %s, and this start is %s: its people's numbers don't match, so the Stars would"
            " go to the wrong person. Start with an empty data folder (keep the old database aside), or, only when the"
            " database holds nothing worth keeping, delete its 'mode' row from the table settings",
            database.path(),
            "with the family hub" if made_in == "hub" else "without the family hub (LOCAL_MODE)",
            "with the family hub" if mode == "hub" else "without it (LOCAL_MODE)",
        )
        raise RuntimeError("The database was made in the other mode (see the line above)")


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_mode()
    if hub.enabled():
        logger.info("Login: the family hub at %s", hub.client.hub_url())
    elif not local.enabled():
        logger.error("Neither HUB_URL nor LOCAL_MODE=1 is set: nobody can play. Set HUB_URL (see docs/deploy-nas.md)")
    else:
        names = ", ".join(f"{p.name} ({p.role})" for p in local.people())
        logger.warning("No HUB_URL: playing without a login. Anybody who opens the page can pick: %s", names)
    yield


app = FastAPI(title="Brightville", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

# The names browsers use for the game, comma-separated: any other name gets nothing, so a web page can't point a name
# of its own at the NAS and read or change the game. Empty: any name
_hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
if _hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[*_hosts, "localhost", "127.0.0.1", "backend"])


@app.middleware("http")
async def home_only(request: Request, call_next):
    """Cloudflare sets Cf-Connecting-Ip on everything through the tunnel: the game is for the home network only."""
    if "cf-connecting-ip" in request.headers:
        return JSONResponse({"detail": {"code": "home_only"}}, status_code=403)
    return await call_next(request)


# Paintings arriving at once: each needs some 30 MB while it is read and checked, so more than this many together
# could pass the container's memory limit. Others wait their turn (nginx gives a request 30 s)
UPLOADS_AT_ONCE = 2
_uploads = asyncio.Semaphore(UPLOADS_AT_ONCE)


@app.middleware("http")
async def uploads_in_turn(request: Request, call_next):
    """Holds a painting's upload until it may be read: the body is read inside call_next, so this comes first."""
    if request.method == "PUT" and request.url.path.startswith("/api/paintings/"):
        async with _uploads:
            return await call_next(request)
    return await call_next(request)


class VisitIn(BaseModel):
    building: str = Field(max_length=40)
    stars: int = Field(ge=0, le=100000)
    key: str = Field(min_length=1, max_length=64)


class FreeVisitIn(BaseModel):
    building: str = Field(max_length=40)
    key: str = Field(min_length=1, max_length=64)


class SeenIn(BaseModel):
    ids: list[str] = Field(max_length=100)


class PlayIn(BaseModel):
    building: str = Field(max_length=40)
    key: str = Field(min_length=1, max_length=64)


class PlayTimeIn(BaseModel):
    seconds: int = Field(ge=1, le=3600)


class RulesIn(BaseModel):
    daily_goal: int = Field(ge=1, le=5)
    play_minutes: Optional[int] = Field(ge=5, le=180)
    # Left out: the Stars stay as they are, with whatever was earned since the page was opened
    stars: Optional[int] = Field(default=None, ge=0, le=9999)


class FilmIn(BaseModel):
    url: str = Field(max_length=500)
    title: str = Field(default="", max_length=60)


class PaintingIn(BaseModel):
    # Data URLs; the sizes are checked after decoding
    image: str = Field(max_length=9 * 1024 * 1024)
    thumb: str = Field(max_length=500 * 1024)


PaintingId = Path(pattern=paintings.ID.pattern)


class LookFields(BaseModel):
    """Her look's shape, refused before it is read in full; the values are checked by wardrobe.save_look"""

    model_config = ConfigDict(extra="forbid")
    body: str = Field(max_length=16)
    hair: str = Field(max_length=16)
    hairColor: str = Field(max_length=16)  # noqa: N815 - the page's name
    glasses: str = Field(max_length=16)


class LookIn(BaseModel):
    look: LookFields


class WornIn(BaseModel):
    worn: dict[str, Optional[str]] = Field(max_length=8)


class BuyIn(BaseModel):
    item: str = Field(max_length=40)
    key: str = Field(min_length=1, max_length=64)


class ChooseIn(BaseModel):
    id: int


def building_of(building_id: str, kind: str) -> Building:
    building = all_buildings().get(building_id)
    if building is None:
        raise error(404, "unknown_building")
    if building.kind != kind:
        raise error(422, "wrong_kind")
    return building


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/me")
def me(request: Request, response: Response, db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Who is playing. Without a hub nobody may be chosen yet: then `people` lists who can be."""
    auth.check_configured()
    if hub.enabled():
        person: Optional[Person] = auth.current_person(request, response, db)
        choices: list[dict] = []
    else:
        person = auth.local_person(request)
        choices = [asdict(p) for p in local.people()]
    return {
        "mode": "hub" if hub.enabled() else "local",
        "person": asdict(person) if person else None,
        "people": choices,
        "login_url": auth.login_url(),
        "logout_url": auth.logout_url(),
    }


@app.post("/api/local/choose")
def choose(body: ChooseIn, request: Request, response: Response) -> dict:
    if hub.enabled():
        raise error(404, "not_found")
    auth.check_configured()
    auth.check_csrf(request)
    if not any(p.id == body.id for p in local.people()):
        raise error(404, "unknown_person")
    response.set_cookie(auth.LOCAL_COOKIE, str(body.id), max_age=365 * 24 * 3600, httponly=True, samesite="lax")
    return {"ok": True}


@app.get("/api/state")
def state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return game.state(db, person.id).as_dict()


@app.post("/api/visits")
def visit(
    body: VisitIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        now, reached = game.visit(db, person.id, building_of(body.building, "earn"), body.stars, body.key)
    except game.TooSoon as soon:
        raise error(409, "too_soon", retry_after=soon.retry_after) from None
    return {"state": now.as_dict(), "goal_reached_now": reached, "stickers": stickers.award(db, person.id)}


@app.post("/api/free-visits")
def free_visit(
    body: FreeVisitIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    game.free_visit(db, person.id, building_of(body.building, "free"), body.key)
    return {"stickers": stickers.award(db, person.id)}


@app.get("/api/stickers")
def sticker_list(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> list:
    # History from before a sticker existed counts: whatever is earned by now is given here
    stickers.award(db, person.id)
    return stickers.listing(db, person.id)


@app.post("/api/stickers/seen")
def stickers_seen(
    body: SeenIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    stickers.mark_seen(db, person.id, body.ids)
    return {"ok": True}


Day = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
Days = Query(default=7, ge=1, le=31)


@app.get("/api/logbook")
def logbook(
    before: Optional[str] = Day,
    days: int = Days,
    person: Person = Depends(auth.current_person),
    db: sqlite3.Connection = Depends(get_db),
) -> list:
    return stickers.logbook(db, person.id, before, days)


@app.post("/api/plays")
def play(body: PlayIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    try:
        return {"state": game.play(db, person.id, building_of(body.building, "play"), body.key).as_dict()}
    except game.Refused as refused:
        raise error(409, refused.code) from None


@app.post("/api/playtime")
def play_time(
    body: PlayTimeIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    return game.add_play_time(db, person.id, body.seconds).as_dict()


@app.get("/api/players")
def players(request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)) -> list[dict]:
    auth.refresh_people(request, db)
    return people.listing(db)


@app.put("/api/players/{person_id}")
def set_rules(
    person_id: int,
    body: RulesIn,
    request: Request,
    _: Person = Depends(auth.parent),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return game.set_rules(db, person_id, body.daily_goal, body.play_minutes, body.stars).as_dict()


@app.get("/api/players/{person_id}/diary")
def diary(
    person_id: int,
    request: Request,
    days: int = Days,
    _: Person = Depends(auth.parent),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """A child's last days and stickers, for the parents' page. Reading it marks nothing as seen."""
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    stickers.award(db, person_id)
    return {"days": stickers.logbook(db, person_id, None, days), "stickers": stickers.listing(db, person_id)}


@app.get("/api/wardrobe")
def wardrobe_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    # Gifts for stickers from before the shop came arrive on the first look
    wardrobe.give_gifts(db, person.id)
    return wardrobe.state(db, person.id)


@app.put("/api/look")
def save_look(
    body: LookIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        wardrobe.save_look(db, person.id, body.look.model_dump())
    except wardrobe.BadLook:
        raise error(422, "bad_look") from None
    return wardrobe.state(db, person.id)


@app.put("/api/worn")
def set_worn(
    body: WornIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    wardrobe.wear(db, person.id, body.worn)
    return wardrobe.state(db, person.id)


@app.post("/api/shop/buy")
def shop_buy(
    body: BuyIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        now = wardrobe.buy(db, person.id, body.item, body.key)
    except game.Refused as refused:
        raise error(404 if refused.code == "unknown" else 409, refused.code) from None
    return {"state": now.as_dict(), "wardrobe": wardrobe.state(db, person.id)}


@app.get("/api/films")
def film_list(_: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> list[dict]:
    return films.listing(db)


@app.post("/api/films")
def add_film(body: FilmIn, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)) -> dict:
    try:
        return films.add(db, body.url, body.title)
    except films.Refused as refused:
        raise error(422 if refused.code == "not_youtube" else 409, refused.code) from None


@app.delete("/api/films/{film_id}")
def remove_film(film_id: int, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)) -> dict:
    if not films.remove(db, film_id):
        raise error(404, "unknown_film")
    return {"ok": True}


@app.get("/api/paintings")
def painting_list(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> list:
    return paintings.listing(db, person.id)


@app.put("/api/paintings/{painting_id}")
def keep_painting(
    body: PaintingIn,
    painting_id: str = PaintingId,
    person: Person = Depends(auth.current_person),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        return paintings.keep(db, person.id, painting_id, body.image, body.thumb)
    except paintings.Refused as refused:
        raise error(413 if refused.code == "too_large" else 422, refused.code) from None


@app.get("/api/paintings/{painting_id}/{which}")
def painting_part(
    which: str,
    painting_id: str = PaintingId,
    person: Person = Depends(auth.current_person),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    found = paintings.part(db, person.id, painting_id, which) if which in ("image", "thumb") else None
    if found is None:
        raise error(404, "unknown_painting")
    data, kind = found
    # Private to whoever is logged in; checked again every time, so painting further shows at once
    return Response(data, media_type=kind, headers={"Cache-Control": "private, no-cache"})


@app.delete("/api/paintings/{painting_id}")
def remove_painting(
    painting_id: str = PaintingId,
    person: Person = Depends(auth.current_person),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    if not paintings.remove(db, person.id, painting_id):
        raise error(404, "unknown_painting")
    return {"ok": True}
