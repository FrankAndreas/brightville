// The two looks of the snake from Spielzeugkiste; a visit takes one at random
export interface SnakeTheme {
  id: string
  say: string
  /** What the collected things are called together */
  collective: string
  colors: { bg: string; grid: string; head: string; body: string[] }
  face: string
  items: string[]
}

export const SNAKE_THEMES: SnakeTheme[] = [
  {
    id: 'einhorn',
    say: 'Einhorn-Schlange! Sammle Sterne und Herzen.',
    collective: 'Schätze',
    colors: { bg: '#FFF0FA', grid: 'rgba(0,0,0,0.05)', head: '#B39DDB', body: ['#FF6B6B', '#FF9A3C', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6'] },
    face: '🦄',
    items: ['⭐', '💖'],
  },
  {
    id: 'prinzessin',
    say: 'Prinzessin-Schlange! Sammle Kronen und Edelsteine.',
    collective: 'Schätze',
    colors: { bg: '#FFE4EE', grid: 'rgba(255,255,255,0.5)', head: '#D02090', body: ['#FF69B4', '#FF82AB'] },
    face: '👸',
    items: ['👑', '💎'],
  },
]
