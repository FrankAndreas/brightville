import { DIRS, isOpposite, type Direction } from './direction'

// Brightville's own mazes: W wall, . sweet, * power-up, P player start,
// G chaser start, space open without a sweet. A row open at both ends is a tunnel.
export const MAZES: Record<string, string[]> = {
  garten: [
    'WWWWWWWWWWWWWWWWW',
    'W*......W......*W',
    'W.WW.WW.W.WW.WW.W',
    'W...............W',
    'W.WW.W.WWW.W.WW.W',
    'W....W..G..W....W',
    'WWWW.WW W WW.WWWW',
    '    .  GWG  .    ',
    'WWWW.W WWW W.WWWW',
    'W.......G.......W',
    'W.WW.WWW.WWW.WW.W',
    'W*.W....P....W.*W',
    'W..W.W.WWW.W.W..W',
    'W....W.....W....W',
    'WWWWWWWWWWWWWWWWW',
  ],
  wolken: [
    'WWWWWWWWWWWWWWWWW',
    'W*.............*W',
    'W.WWWW.W.W.WWWW.W',
    'W...............W',
    'WW.W.WWW.WWW.W.WW',
    'W..W...W.W...W..W',
    'W.WWWW.....WWWW.W',
    ' ....W GGG W.... ',
    'W.WW.W WWW W.WW.W',
    'W....W  G  W....W',
    'WW.W.WWW.WWW.W.WW',
    'W..W....P....W..W',
    'W.WW.WW.W.WW.WW.W',
    'W*.............*W',
    'WWWWWWWWWWWWWWWWW',
  ],
}

// Tiles per second; the player always outruns the monsters
export const SPEEDS = {
  langsam: { player: 4, monster: 2.5 },
  mittel: { player: 5, monster: 3.5 },
  schnell: { player: 6, monster: 4.5 },
}
export type Speed = keyof typeof SPEEDS
export const SCORES = { dot: 10, power: 50, monster: 200 }
export const LIVES = 5
export const SCARED_MS = 6000
export const SAFE_MS = 2000 // a caught monster can't hurt anyone this long after respawning

const MONSTERS = 4 // one per theme sprite
const HIT = 0.6 // tiles between centres that count as touching
const SLICE = 1000 / 60 // ms per simulation step, small enough not to miss a touch
const MAX_DT = 100 // ms simulated per update at most

const ORDER: Direction[] = ['up', 'down', 'left', 'right']
const key = (x: number, y: number) => `${x},${y}`

export interface Actor {
  x: number
  y: number
  dir: Direction
  /** 0…1 of the way to the next tile */
  progress: number
  start: { x: number; y: number }
  speed: number
  scared: boolean
  safeMs: number
}

export type MazeEvent = 'dot' | 'power' | 'caught' | 'life-lost' | 'half' | 'cleared' | 'game-over'

export interface MazeGame {
  cols: number
  rows: number
  walls: Set<string>
  dots: Set<string>
  powers: Set<string>
  total: number
  eaten: number
  halfDone: boolean
  player: Actor
  monsters: Actor[]
  wish: Direction | null
  lives: number
  score: number
  scaredMs: number
  over: boolean
  cleared: boolean
}

function actor(x: number, y: number, speed: number): Actor {
  return { x, y, dir: 'up', progress: 0, start: { x, y }, speed, scared: false, safeMs: 0 }
}

/** A new game on the given maze rows at a speed from SPEEDS. */
export function createGame(maze: string[], speed: Speed = 'langsam'): MazeGame {
  const s = SPEEDS[speed] ?? SPEEDS.langsam
  const game: MazeGame = {
    cols: maze[0].length, rows: maze.length,
    walls: new Set(), dots: new Set(), powers: new Set(),
    total: 0, eaten: 0, halfDone: false,
    player: actor(1, 1, s.player), monsters: [], wish: null,
    lives: LIVES, score: 0, scaredMs: 0, over: false, cleared: false,
  }
  maze.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'W') game.walls.add(key(x, y))
    if (c === '.') game.dots.add(key(x, y))
    if (c === '*') game.powers.add(key(x, y))
    if (c === 'P') game.player = actor(x, y, s.player)
    if (c === 'G' && game.monsters.length < MONSTERS) game.monsters.push(actor(x, y, s.monster))
  }))
  game.total = game.dots.size + game.powers.size
  return game
}

/** Continuous position of an actor in tiles, for drawing and touching. */
export function position(a: Actor): { x: number; y: number } {
  return { x: a.x + DIRS[a.dir].x * a.progress, y: a.y + DIRS[a.dir].y * a.progress }
}

/**
 * The player's wish. A reversal applies at once, even between tiles; any
 * other turn waits for the next tile where that way is open.
 */
export function setDirection(game: MazeGame, dir: Direction): void {
  const p = game.player
  if (p.progress > 0 && isOpposite(dir, p.dir)) {
    p.x = wrapX(game, p.x + DIRS[p.dir].x)
    p.y += DIRS[p.dir].y
    p.dir = dir
    p.progress = 1 - p.progress
    game.wish = null
  } else {
    game.wish = dir
  }
}

const wrapX = (game: MazeGame, x: number) => (x + game.cols) % game.cols

function open(game: MazeGame, x: number, y: number, dir: Direction) {
  const ny = y + DIRS[dir].y
  if (ny < 0 || ny >= game.rows) return false
  return !game.walls.has(key(wrapX(game, x + DIRS[dir].x), ny))
}

/**
 * Advances the game by dtMs (at most MAX_DT) in small slices and returns what
 * happened: 'dot', 'power', 'caught', 'life-lost', 'half', 'cleared', 'game-over'.
 */
export function update(game: MazeGame, dtMs: number, random: () => number = Math.random): MazeEvent[] {
  const events: MazeEvent[] = []
  let left = Math.min(dtMs, MAX_DT)
  while (left > 0 && !game.over && !game.cleared) {
    const slice = Math.min(SLICE, left)
    left -= slice
    game.scaredMs = Math.max(0, game.scaredMs - slice)
    game.monsters.forEach(m => {
      if (!game.scaredMs) m.scared = false
      m.safeMs = Math.max(0, m.safeMs - slice)
    })

    movePlayer(game, slice / 1000, events)
    if (game.cleared) break
    game.monsters.forEach(m => moveMonster(game, m, slice / 1000, random))
    if (touch(game, events)) break
  }
  return events
}

function movePlayer(game: MazeGame, dt: number, events: MazeEvent[]) {
  const p = game.player
  let budget = p.speed * dt
  while (budget > 0) {
    if (p.progress === 0) {
      if (game.wish && open(game, p.x, p.y, game.wish)) p.dir = game.wish
      if (!open(game, p.x, p.y, p.dir)) return
    }
    const stepTo = Math.min(budget, 1 - p.progress)
    p.progress += stepTo
    budget -= stepTo
    if (p.progress >= 1) {
      p.x = wrapX(game, p.x + DIRS[p.dir].x)
      p.y += DIRS[p.dir].y
      p.progress = 0
      eat(game, events)
      if (game.cleared) return
    }
  }
}

function eat(game: MazeGame, events: MazeEvent[]) {
  const k = key(game.player.x, game.player.y)
  if (game.dots.delete(k)) {
    game.score += SCORES.dot
    events.push('dot')
  } else if (game.powers.delete(k)) {
    game.score += SCORES.power
    game.scaredMs = SCARED_MS
    game.monsters.forEach(m => { m.scared = true })
    events.push('power')
  } else {
    return
  }
  game.eaten++
  if (!game.halfDone && game.eaten * 2 >= game.total) {
    game.halfDone = true
    events.push('half')
  }
  if (game.eaten === game.total) {
    game.cleared = true
    events.push('cleared')
  }
}

// Monsters wander: at each tile they pick a random open way, turning back
// only at a dead end. Scared ones move at half speed.
function moveMonster(game: MazeGame, m: Actor, dt: number, random: () => number) {
  let budget = m.speed * (m.scared ? 0.5 : 1) * dt
  while (budget > 0) {
    if (m.progress === 0) {
      const ways = ORDER.filter(d => open(game, m.x, m.y, d))
      if (!ways.length) return
      const forward = ways.filter(d => !isOpposite(d, m.dir))
      const choices = forward.length ? forward : ways
      m.dir = choices[Math.floor(random() * choices.length)]
    }
    const stepTo = Math.min(budget, 1 - m.progress)
    m.progress += stepTo
    budget -= stepTo
    if (m.progress >= 1) {
      m.x = wrapX(game, m.x + DIRS[m.dir].x)
      m.y += DIRS[m.dir].y
      m.progress = 0
    }
  }
}

function reset(a: Actor) {
  a.x = a.start.x
  a.y = a.start.y
  a.dir = 'up'
  a.progress = 0
  a.scared = false
  a.safeMs = 0
}

// Returns true when the player lost a life (the round restarts)
function touch(game: MazeGame, events: MazeEvent[]) {
  const p = position(game.player)
  for (const m of game.monsters) {
    const q = position(m)
    if (m.safeMs || Math.hypot(p.x - q.x, p.y - q.y) >= HIT) continue
    if (m.scared) {
      game.score += SCORES.monster
      reset(m)
      m.safeMs = SAFE_MS
      events.push('caught')
      continue
    }
    game.lives--
    events.push('life-lost')
    reset(game.player)
    game.monsters.forEach(reset)
    game.wish = null
    if (game.lives === 0) {
      game.over = true
      events.push('game-over')
    }
    return true
  }
  return false
}
