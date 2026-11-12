"""Brightville's server: who is playing, their Stars and today's numbers, and the parents' settings."""

import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Optional

from fastapi import Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import auth, game, hub, local, people
from .auth import error, get_db
from .buildings import Building, all_buildings
from .people import Person

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI):
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


class VisitIn(BaseModel):
    building: str = Field(max_length=40)
    stars: int = Field(ge=0, le=100000)
    key: str = Field(min_length=1, max_length=64)


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
    now, reached = game.visit(db, person.id, building_of(body.building, "earn"), body.stars, body.key)
    return {"state": now.as_dict(), "goal_reached_now": reached}


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
