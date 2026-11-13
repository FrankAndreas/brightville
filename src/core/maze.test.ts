import { describe, it, expect } from 'vitest'
import { MAZES, SPEEDS, SCORES, LIVES, SCARED_MS, createGame, setDirection, position, update, type MazeEvent, type MazeGame } from './maze'

// Always picks the first option, so monsters are predictable
const first = () => 0

// Runs `ms` of game time in 100 ms calls and collects the events
function run(game: MazeGame, ms: number) {
  const events: MazeEvent[] = []
  for (let t = 0; t < ms; t += 100) events.push(...update(game, 100, first))
  return events
}

describe('createGame', () => {
  it('reads every maze: one player, four chasers, five lives', () => {
    for (const [name, maze] of Object.entries(MAZES)) {
      const game = createGame(maze, 'langsam')
      expect(game.cols, name).toBe(maze[0].length)
      expect(game.rows, name).toBe(maze.length)
      expect(game.monsters, name).toHaveLength(4)
      expect(game.lives).toBe(LIVES)
      const count = maze.join('').split('').filter(c => c === '.' || c === '*').length
      expect(game.total, name).toBe(count)
      expect(game.dots.size + game.powers.size, name).toBe(count)
    }
    expect(LIVES).toBe(5)
  })

  it('starts the player at P', () => {
    const game = createGame(['WWW', 'WPW', 'WWW'], 'langsam')
    expect(position(game.player)).toEqual({ x: 1, y: 1 })
  })
})

describe('the mazes', () => {
  const open = (maze: string[], x: number, y: number) => y >= 0 && y < maze.length && maze[y][(x + maze[0].length) % maze[0].length] !== 'W'
  const ways = (maze: string[], x: number, y: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(maze, x + dx, y + dy)).length

  it('has at least two, each with rows of one length and a closed top and bottom', () => {
    expect(Object.keys(MAZES).length).toBeGreaterThanOrEqual(2)
    for (const [name, maze] of Object.entries(MAZES)) {
      expect(new Set(maze.map(r => r.length)).size, name).toBe(1)
      expect(maze[0].replace(/W/g, ''), name).toBe('')
      expect(maze[maze.length - 1].replace(/W/g, ''), name).toBe('')
      // A row is either closed at both sides or a tunnel open at both
      for (const row of maze) expect(row[0] === 'W', name).toBe(row[row.length - 1] === 'W')
    }
  })

  it('lets the player reach every sweet and every chaser', () => {
    for (const [name, maze] of Object.entries(MAZES)) {
      const w = maze[0].length
      const startY = maze.findIndex(r => r.includes('P'))
      const seen = new Set([`${maze[startY].indexOf('P')},${startY}`])
      const queue = [[maze[startY].indexOf('P'), startY]]
      while (queue.length) {
        const [x, y] = queue.shift()!
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = (x + dx + w) % w, ny = y + dy
          if (open(maze, nx, ny) && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`)
            queue.push([nx, ny])
          }
        }
      }
      maze.forEach((row, y) => [...row].forEach((c, x) => {
        if ('.*G'.includes(c)) expect(seen.has(`${x},${y}`), `${name} ${x},${y}`).toBe(true)
      }))
    }
  })

  it('has no dead ends, where a chaser could corner the player', () => {
    for (const [name, maze] of Object.entries(MAZES)) {
      maze.forEach((row, y) => [...row].forEach((c, x) => {
        if (c !== 'W') expect(ways(maze, x, y), `${name} ${x},${y}`).toBeGreaterThanOrEqual(2)
      }))
    }
  })
})

describe('SPEEDS', () => {
  it('keeps the player faster than the monsters at every level', () => {
    for (const s of Object.values(SPEEDS)) expect(s.player).toBeGreaterThan(s.monster)
  })
})

describe('moving', () => {
  it('eats the dots along a corridor', () => {
    const game = createGame(['WWWWWWW', 'WP....W', 'WWWWWWW'], 'langsam')
    setDirection(game, 'right')
    const events = run(game, 1200)
    expect(game.score).toBe(4 * SCORES.dot)
    expect(events.filter(e => e === 'dot')).toHaveLength(4)
  })

  it('stops in front of a wall', () => {
    const game = createGame(['WWW', 'WPW', 'WWW'], 'langsam')
    setDirection(game, 'right')
    run(game, 500)
    expect(game.player.progress).toBe(0)
    expect(position(game.player)).toEqual({ x: 1, y: 1 })
  })

  it('turns around immediately mid-tile', () => {
    const game = createGame(['WWWWWWW', 'WP....W', 'WWWWWWW'], 'langsam')
    setDirection(game, 'right')
    run(game, 100)
    const before = position(game.player)
    setDirection(game, 'left')
    expect(position(game.player).x).toBeCloseTo(before.x)
    run(game, 100)
    expect(position(game.player).x).toBeLessThan(before.x)
  })

  it('takes a queued turn at the next junction', () => {
    const game = createGame(['WWWWW', 'WP..W', 'WW.WW', 'WWWWW'], 'langsam')
    setDirection(game, 'right')
    run(game, 100)
    setDirection(game, 'down')
    run(game, 500)
    expect(position(game.player)).toEqual({ x: 2, y: 2 })
  })

  it('wraps through the tunnel', () => {
    const game = createGame(['WWWWW', '  P  ', 'WWWWW'], 'langsam')
    setDirection(game, 'left')
    run(game, 800)
    expect(game.player.x).toBe(4)
  })

  it('never moves more than 100 ms worth in one call', () => {
    const game = createGame(['WWWWWWWWWWWWWW', 'WP...........W', 'WWWWWWWWWWWWWW'], 'langsam')
    setDirection(game, 'right')
    update(game, 5000)
    expect(position(game.player).x - 1).toBeLessThanOrEqual(0.4 + 1e-9)
  })
})

describe('monsters', () => {
  it('cannot pass through the player between frames', () => {
    const game = createGame(['WWWWWWW', 'WPG...W', 'WWWWWWW'], 'langsam')
    setDirection(game, 'right')
    expect(update(game, 100, first)).toContain('life-lost')
    expect(game.lives).toBe(LIVES - 1)
  })

  it('puts everyone back at the start after a lost life', () => {
    const game = createGame(['WWWWWWW', 'WPG...W', 'WWWWWWW'], 'langsam')
    setDirection(game, 'right')
    update(game, 100, first)
    expect(position(game.player)).toEqual({ x: 1, y: 1 })
    expect(position(game.monsters[0])).toEqual({ x: 2, y: 1 })
  })

  it('ends the game with the last life', () => {
    const game = createGame(['WWWWWWW', 'WPG...W', 'WWWWWWW'], 'langsam')
    game.lives = 1
    setDirection(game, 'right')
    const events = update(game, 100, first)
    expect(events).toContain('game-over')
    expect(game.over).toBe(true)
    expect(update(game, 100, first)).toEqual([])
  })

  it('can be caught after a power-up', () => {
    const game = createGame(['WWWWWWW', 'WP*  GW', 'WWWWWWW', 'W.....W', 'WWWWWWW'], 'langsam')
    setDirection(game, 'right')
    const events: MazeEvent[] = []
    for (let i = 0; i < 15 && !events.includes('caught'); i++) events.push(...update(game, 100, first))
    expect(events).toContain('power')
    expect(events).toContain('caught')
    expect(events).not.toContain('life-lost')
    expect(game.score).toBe(SCORES.power + SCORES.monster)
    expect(game.monsters[0].scared).toBe(false)
  })

  it('does not take a life right after being caught next to the player', () => {
    // The monster's start is one tile ahead of where the player catches it
    const game = createGame(['WWWWWWWW', 'WP G...W', 'WWWWWWWW', 'W......W', 'WWWWWWWW'], 'langsam')
    game.scaredMs = SCARED_MS
    game.monsters[0].scared = true
    setDirection(game, 'right')
    const events = run(game, 1500)
    expect(events).toContain('caught')
    expect(events).not.toContain('life-lost')
    expect(game.lives).toBe(LIVES)
  })

  it('stays scared for SCARED_MS after a power-up', () => {
    const game = createGame(['WWWWWWWWW', 'WP*     W', 'WWWWWWWWW', 'W.......W', 'WWWWWWWWW'], 'langsam')
    setDirection(game, 'right')
    run(game, 300)
    expect(game.scaredMs).toBeGreaterThan(SCARED_MS - 300)
    expect(game.scaredMs).toBeLessThanOrEqual(SCARED_MS)
  })
})

describe('progress events', () => {
  it('cheers once at half and clears the maze at the end', () => {
    const game = createGame(['WWWWWWW', 'WP....W', 'WWWWWWW'], 'langsam')
    setDirection(game, 'right')
    const events = run(game, 1500)
    expect(events.filter(e => e === 'half')).toHaveLength(1)
    expect(events).toContain('cleared')
    expect(game.cleared).toBe(true)
  })
})
