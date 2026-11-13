// The four scenes from Spielzeugkiste. Each candidate difference is a
// `<g data-diff>` group with an original and one or more variants (see core/differences).

export const SCENES = ['bauernhof', 'meer', 'spielplatz', 'weltraum']

const files = import.meta.glob<string>('./scenes/*.svg', { query: '?raw', import: 'default' })

export async function loadScene(id: string): Promise<string> {
  const load = files[`./scenes/${id}.svg`]
  if (!load) throw new Error(`No scene ${id}`)
  return load()
}

/** A scene at random, never the one before. */
export function pickScene(last: string | null, random: () => number = Math.random): string {
  const choices = SCENES.filter(s => s !== last)
  return choices[Math.floor(random() * choices.length)]
}
