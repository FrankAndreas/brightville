/** A list pasted or typed by him: one pair per line, German first */

const SEPARATORS = [' - ', ' – ', ' = ', ';']

/**
 * The pairs of a pasted list, and the (1-based) numbers of the lines that have text but can't be read (no separator, or
 * a side left empty): those are shown marked and not kept. A tab wins over the other separators; otherwise the first
 * of ` - `, ` – `, ` = `, `;` in the line splits it. A BOM, Windows line ends and non-breaking spaces are taken as
 * they come from Word, Excel or a PDF.
 */
export function parseList(text: string): { pairs: { de: string; foreign: string }[]; bad: number[] } {
  const pairs: { de: string; foreign: string }[] = []
  const bad: number[] = []
  text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).forEach((raw, i) => {
    const line = raw.replace(/[\u00a0\u2007\u202f]/g, ' ')
    if (!line.trim()) return
    const split = splitLine(line)
    const de = split?.[0].replace(/\s+/g, ' ').trim() ?? ''
    const foreign = split?.[1].replace(/\s+/g, ' ').trim() ?? ''
    if (de && foreign) pairs.push({ de, foreign })
    else bad.push(i + 1)
  })
  return { pairs, bad }
}

function splitLine(line: string): [string, string] | null {
  const tab = line.indexOf('\t')
  if (tab >= 0) return [line.slice(0, tab), line.slice(tab + 1)]
  let best: { at: number; length: number } | null = null
  for (const sep of SEPARATORS) {
    const at = line.indexOf(sep)
    if (at >= 0 && (!best || at < best.at)) best = { at, length: sep.length }
  }
  return best ? [line.slice(0, best.at), line.slice(best.at + best.length)] : null
}
