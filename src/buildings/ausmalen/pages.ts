// The coloring pages from Spielzeugkiste: line pictures whose parts (`data-region`) take a colour

export interface Page {
  id: string
  icon: string
  /** Said when the page opens */
  say: string
}

export const PAGES: Page[] = [
  { id: 'lion', icon: '🦁', say: 'Der Löwe' },
  { id: 'elephant', icon: '🐘', say: 'Der Elefant' },
  { id: 'einhorn', icon: '🦄', say: 'Das Einhorn' },
  { id: 'regenbogen', icon: '🌈', say: 'Der Regenbogen' },
  { id: 'cupcake', icon: '🧁', say: 'Der Cupcake' },
  { id: 'prinzessin', icon: '👸', say: 'Die Prinzessin' },
  { id: 'schloss', icon: '🏰', say: 'Das Schloss' },
  { id: 'krone', icon: '👑', say: 'Die Krone' },
  { id: 'schneemann', icon: '⛄', say: 'Der Schneemann' },
  { id: 'schneeflocke', icon: '❄️', say: 'Die Schneeflocke' },
  { id: 'schlitten', icon: '🛷', say: 'Der Schlitten' },
  { id: 'feuerwehrauto', icon: '🚒', say: 'Das Feuerwehrauto' },
  { id: 'helm', icon: '⛑️', say: 'Der Feuerwehrhelm' },
  { id: 'hydrant', icon: '🧯', say: 'Der Hydrant' },
  { id: 'ballerina', icon: '💃', say: 'Die Ballerina' },
  { id: 'ballettschuhe', icon: '🩰', say: 'Die Ballettschuhe' },
  { id: 'blume', icon: '🌸', say: 'Die Blume' },
  { id: 'gitarre', icon: '🎸', say: 'Die Gitarre' },
  { id: 'trommel', icon: '🥁', say: 'Die Trommel' },
  { id: 'klavier', icon: '🎹', say: 'Das Klavier' },
]

/** The paper colour every part starts with */
export const BLANK = '#f5f0e8'
export const COLORS = ['#FFD93D', '#FF9A3C', '#FF6B6B', '#FF6FC8', '#C77DFF', '#4D96FF', '#6BCB77', '#795548', '#607D8B', BLANK]

// Each page is its own small file, fetched when it is opened
const files = import.meta.glob<string>('./pages/*.svg', { query: '?raw', import: 'default' })

/** The SVG source of a page. */
export async function loadPage(id: string): Promise<string> {
  const load = files[`./pages/${id}.svg`]
  if (!load) throw new Error(`No coloring page ${id}`)
  return (await load()).trim()
}
