// The two looks of the maze game, from Spielzeugkiste; a visit takes one at random
export interface MazeTheme {
  id: string
  say: string
  colors: { bg: string; wall: string; dot: string }
  player: string
  chasers: string[]
  scared: string
  power: string
}

export const MAZE_THEMES: MazeTheme[] = [
  {
    id: 'einhorn',
    say: 'Bonbonjagd! Sammle alle Bonbons. Der Donut macht dich stark.',
    colors: { bg: '#1e1b4b', wall: '#a855f7', dot: '#FF8FC8' },
    player: '🦄',
    chasers: ['🐉', '🦖', '🦈', '🐙'],
    scared: '🥶',
    power: '🍩',
  },
  {
    id: 'prinzessin',
    say: 'Bonbonjagd! Sammle alle Edelsteine. Die Krone macht dich stark.',
    colors: { bg: '#4a1942', wall: '#FF69B4', dot: '#B9F2FF' },
    player: '👸',
    chasers: ['🐺', '🧙', '🕷️', '🐍'],
    scared: '😵',
    power: '👑',
  },
]
