"""Brightville's server: who is playing, their Stars and today's numbers, and the parents' settings."""

import asyncio
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Literal, Annotated, Optional, TYPE_CHECKING

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StringConstraints, create_model
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import (
    auth,
    dates,
    films,
    game,
    grammar,
    hub,
    listen,
    local,
    paintings,
    people,
    reading,
    room,
    school,
    stickers,
    vocab,
    wardrobe,
    writing,
)
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


class LadderResultIn(BaseModel):
    step: int = Field(ge=1, le=6)
    # First try right or not, per answered task; a visit has five tasks
    results: list[bool] = Field(max_length=10)


class _SchoolResultsBase(BaseModel):
    # A ladder this server doesn't know (a newer page during an update) is refused: the device keeps the result and
    # sends it again later, instead of the server taking its key and dropping the answers
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=64)


# A visit's answers, one optional field per ladder of shared/ladders.json: the School sends Zählen and Rechnen, the
# other learning buildings one each. A new ladder needs no change here.
if TYPE_CHECKING:
    SchoolResultsIn = _SchoolResultsBase
else:
    SchoolResultsIn = create_model(
        "SchoolResultsIn",
        __base__=_SchoolResultsBase,
        **{ladder: (LadderResultIn | None, None) for ladder in school.WINDOW},
    )


class StepIn(BaseModel):
    # Checked by school.set_step, to answer "unknown" / "bad_step" in words
    ladder: str = Field(max_length=20)
    # Strict: true or 2.5 is no step
    step: StrictInt


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
    # Left out: the level stays
    level: Optional[Literal["kindergarten", "oberstufe"]] = None


class VocabWordIn(BaseModel):
    # Checked again after trimming (vocab.check), to answer "too-long" / "empty" in words
    de: str = Field(max_length=200)
    foreign: str = Field(max_length=200)


class VocabListIn(BaseModel):
    lang: Literal["en", "fr"]
    name: str = Field(max_length=200)
    words: list[VocabWordIn] = Field(max_length=200)


class VocabAnswerIn(BaseModel):
    word: str = Field(min_length=1, max_length=200)
    right: bool


class VocabResultsIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    lang: Literal["en", "fr"]
    answers: list[VocabAnswerIn] = Field(max_length=100)


class ListenAnswerIn(BaseModel):
    scene: str = Field(min_length=1, max_length=200)
    right: bool


class ListenResultsIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    lang: Literal["en", "fr"]
    answers: list[ListenAnswerIn] = Field(max_length=20)


class GrammarAnswerIn(BaseModel):
    item: str = Field(min_length=1, max_length=120)
    right: bool


class GrammarResultsIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    lang: Literal["en", "fr"]
    answers: list[GrammarAnswerIn] = Field(max_length=40)


class ReadingAnswerIn(BaseModel):
    text: str = Field(min_length=1, max_length=120)
    right: int = Field(ge=0, le=4)


class ReadingResultsIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    lang: Literal["en", "fr"]
    answers: list[ReadingAnswerIn] = Field(max_length=5)


class DatesAnswerIn(BaseModel):
    kind: str = Field(min_length=1, max_length=40)
    right: bool


class DatesResultsIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    lang: Literal["en", "fr"]
    answers: list[DatesAnswerIn] = Field(max_length=40)


class FilmIn(BaseModel):
    url: str = Field(max_length=500)
    title: str = Field(default="", max_length=60)
    # Left out: her list (Kindergarten)
    level: Literal["kindergarten", "oberstufe"] = "kindergarten"


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


# A place, a spot or an item id: short words (the catalogues' longest id is under 20 letters)
ShortId = Annotated[str, StringConstraints(max_length=40)]


class WornIn(BaseModel):
    worn: dict[ShortId, Optional[ShortId]] = Field(max_length=8)


class BuyIn(BaseModel):
    item: str = Field(max_length=40)
    key: str = Field(min_length=1, max_length=64)


class PlacedIn(BaseModel):
    placed: dict[ShortId, Optional[ShortId]] = Field(max_length=10)


class WriteIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    glyph: str = Field(min_length=1, max_length=2)
    level: int = Field(ge=1, le=4)
    clean: bool


class WritesIn(BaseModel):
    writes: list[WriteIn] = Field(max_length=50)


class IntroducedIn(BaseModel):
    glyph: str = Field(min_length=1, max_length=2)
    # Sent by the page from before; meeting a letter twice is meeting it once
    key: str = Field(default="", max_length=64)
    # The device's day, when the letter was met while the server was away
    day: Optional[str] = Field(default=None, max_length=10)


class TextsIn(BaseModel):
    # Checked again after trimming (writing.check); the list's length too, to answer "too-many" in words
    texts: list[Annotated[str, StringConstraints(max_length=60)]] = Field(max_length=100)


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
    except game.Refused as refused:
        raise error(409, refused.code) from None
    return {"state": now.as_dict(), "goal_reached_now": reached, "stickers": stickers.award(db, person.id)}


@app.post("/api/free-visits")
def free_visit(
    body: FreeVisitIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        game.free_visit(db, person.id, building_of(body.building, "free"), body.key)
    except game.Refused as refused:
        raise error(409, refused.code) from None
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
    return game.set_rules(db, person_id, body.daily_goal, body.play_minutes, body.stars, body.level).as_dict()


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


@app.get("/api/room")
def room_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return room.state(db, person.id)


@app.put("/api/room/placed")
def set_placed(
    body: PlacedIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    room.place(db, person.id, body.placed)
    return room.state(db, person.id)


@app.post("/api/moebel/buy")
def moebel_buy(
    body: BuyIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        now = room.buy(db, person.id, body.item, body.key)
    except game.Refused as refused:
        raise error(404 if refused.code == "unknown" else 409, refused.code) from None
    return {"state": now.as_dict(), "room": room.state(db, person.id)}


@app.get("/api/films")
def film_list(_: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> list[dict]:
    return films.listing(db)


@app.post("/api/films")
def add_film(body: FilmIn, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)) -> dict:
    try:
        return films.add(db, body.url, body.title, body.level)
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


@app.get("/api/writing")
def writing_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return writing.state(db, person.id)


@app.post("/api/writing/writes")
def writing_writes(
    body: WritesIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    writing.record(db, person.id, [w.model_dump() for w in body.writes])  # type: ignore[misc]
    return writing.state(db, person.id)


@app.post("/api/writing/introduced")
def writing_introduced(
    body: IntroducedIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        writing.introduce(db, person.id, body.glyph, body.day)
    except game.Refused as refused:
        raise error(404 if refused.code == "unknown" else 409, refused.code) from None
    return writing.state(db, person.id)


@app.get("/api/school")
def school_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return school.state(db, person.id)


@app.post("/api/school/results")
def school_results(
    body: SchoolResultsIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    school.record(
        db,
        person.id,
        body.key,
        {name: (ladder.model_dump() if ladder else None) for name, ladder in body if name != "key"},
    )
    return school.state(db, person.id)


@app.get("/api/players/{person_id}/school")
def player_school(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return school.state(db, person_id)


@app.put("/api/players/{person_id}/school")
def player_school_step(
    person_id: int,
    body: StepIn,
    request: Request,
    _: Person = Depends(auth.parent),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    try:
        school.set_step(db, person_id, body.ladder, body.step)
    except game.Refused as refused:
        raise error(422, refused.code) from None
    return school.state(db, person_id)


@app.get("/api/vocab")
def vocab_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return vocab.state(db, person.id)


def _vocab_refused(refused: game.Refused) -> HTTPException:
    return error(404 if refused.code == "unknown" else 422, refused.code)


@app.post("/api/vocab/lists")
def vocab_create(
    body: VocabListIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    try:
        return vocab.create(
            db, person.id, body.lang, body.name, [vocab.Word(de=w.de, foreign=w.foreign) for w in body.words]
        )
    except game.Refused as refused:
        raise _vocab_refused(refused) from None


@app.put("/api/vocab/lists/{list_id}")
def vocab_update(
    list_id: int,
    body: VocabListIn,
    person: Person = Depends(auth.current_person),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        return vocab.update(
            db, person.id, list_id, body.lang, body.name, [vocab.Word(de=w.de, foreign=w.foreign) for w in body.words]
        )
    except game.Refused as refused:
        raise _vocab_refused(refused) from None


@app.delete("/api/vocab/lists/{list_id}")
def vocab_delete(
    list_id: int, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    """Answers with his vocabulary as it is now (the page reads every answer as JSON)"""
    try:
        vocab.delete(db, person.id, list_id)
    except game.Refused as refused:
        raise _vocab_refused(refused) from None
    return vocab.state(db, person.id)


@app.post("/api/vocab/results")
def vocab_results(
    body: VocabResultsIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    vocab.record(db, person.id, body.key, body.lang, [vocab.Answer(word=a.word, right=a.right) for a in body.answers])
    return vocab.state(db, person.id)


@app.get("/api/players/{person_id}/vocab")
def player_vocab(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return vocab.state(db, person_id, seen=False)


@app.get("/api/listen")
def listen_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return listen.state(db, person.id)


@app.post("/api/listen/results")
def listen_results(
    body: ListenResultsIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    listen.record(
        db, person.id, body.key, body.lang, [listen.Answer(scene=a.scene, right=a.right) for a in body.answers]
    )
    return listen.state(db, person.id)


@app.get("/api/players/{person_id}/listen")
def player_listen(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return listen.state(db, person_id, seen=False)


@app.get("/api/grammar")
def grammar_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return grammar.state(db, person.id)


@app.post("/api/grammar/results")
def grammar_results(
    body: GrammarResultsIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    grammar.record(
        db, person.id, body.key, body.lang, [grammar.Answer(item=a.item, right=a.right) for a in body.answers]
    )
    return grammar.state(db, person.id)


@app.get("/api/players/{person_id}/grammar")
def player_grammar(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return grammar.state(db, person_id, seen=False)


@app.get("/api/reading")
def reading_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return reading.state(db, person.id)


@app.post("/api/reading/results")
def reading_results(
    body: ReadingResultsIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    reading.record(
        db, person.id, body.key, body.lang, [reading.Answer(text=a.text, right=a.right) for a in body.answers]
    )
    return reading.state(db, person.id)


@app.get("/api/players/{person_id}/reading")
def player_reading(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return reading.state(db, person_id, seen=False)


@app.get("/api/dates")
def dates_state(person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)) -> dict:
    return dates.state(db, person.id)


@app.post("/api/dates/results")
def dates_results(
    body: DatesResultsIn, person: Person = Depends(auth.current_person), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    dates.record(db, person.id, body.key, body.lang, [dates.Answer(kind=a.kind, right=a.right) for a in body.answers])
    return dates.state(db, person.id)


@app.get("/api/players/{person_id}/dates")
def player_dates(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return dates.state(db, person_id, seen=False)


@app.get("/api/players/{person_id}/writing")
def player_writing(
    person_id: int, request: Request, _: Person = Depends(auth.parent), db: sqlite3.Connection = Depends(get_db)
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    return writing.state(db, person_id)


@app.put("/api/players/{person_id}/writing/texts")
def player_texts(
    person_id: int,
    body: TextsIn,
    request: Request,
    _: Person = Depends(auth.parent),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    auth.refresh_people(request, db)
    if not people.is_active(db, person_id):
        raise error(404, "unknown_person")
    try:
        writing.set_texts(db, person_id, body.texts)
    except game.Refused as refused:
        raise error(422, refused.code) from None
    return writing.state(db, person_id)
