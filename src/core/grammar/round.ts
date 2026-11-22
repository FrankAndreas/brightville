import type { RoundItem } from '@/core/vocab/round'
import type { Lang } from '@/core/vocab/types'
import { GRAMMAR } from './content'
import { itemByKey, itemsOf, type GrammarItem } from './items'

export const GRAMMAR_ROUND = 10
/** Of his last 10 first answers in a topic: from this many right on he types instead of choosing */
const TYPE_FROM = 5
/** … and from this many it counts as sure */
const SURE_FROM = 8
/** A topic counts as weak only after this many tries */
const WEAK_AFTER = 5

/** His record per topic `<lang>:<topic>`, as the server keeps it (backend/app/grammar.py) */
export type GrammarProgress = Record<string, { recent: boolean[]; missed: string[] }>
type TopicRecord = GrammarProgress[string] | undefined

export const rightOfLast10 = (p: TopicRecord) => (p?.recent ?? []).slice(-10).filter(Boolean).length
export const typesNow = (p: TopicRecord) => rightOfLast10(p) >= TYPE_FROM
export const isSure = (p: TopicRecord) => rightOfLast10(p) >= SURE_FROM
export const isWeak = (p: TopicRecord) => (p?.recent?.length ?? 0) >= WEAK_AFTER && rightOfLast10(p) < SURE_FROM

/** The weak topics of a language, the fewest right first (at most `n`) */
export function weakest(lang: Lang, progress: GrammarProgress, n = 3): string[] {
  return GRAMMAR[lang]
    .map(t => ({ id: t.id, p: progress[`${lang}:${t.id}`] }))
    .filter(x => isWeak(x.p))
    .sort((a, b) => rightOfLast10(a.p) - rightOfLast10(b.p))
    .slice(0, n)
    .map(x => x.id)
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** An item as the round flow asks it: typed (`type-de`: the sentence shown, he types the gap) or one of four */
export function toRoundItem(item: GrammarItem, typed: boolean, rand: () => number): RoundItem {
  const word = { key: item.key, de: item.text, foreign: item.answers.join(' / '), source: item.topic }
  if (typed) return { word, mode: 'type-de' }
  // A gap that starts the sentence: its choices start with a capital, as the sentence will
  const start = item.text.startsWith('___')
  const shown = (c: string) => (start ? c.charAt(0).toUpperCase() + c.slice(1) : c)
  const choices = shuffle([item.answers[0], ...shuffle(item.wrong, rand).slice(0, 3)], rand).map(shown)
  return { word, mode: 'choice', choices }
}

/** A topic's items in the order to ask them: those he missed last first, the rest mixed */
function queueOf(lang: Lang, topic: string, progress: GrammarProgress, rand: () => number): GrammarItem[] {
  const missed = (progress[`${lang}:${topic}`]?.missed ?? []).map(itemByKey).filter((i): i is GrammarItem => !!i && i.topic === topic)
  const taken = new Set(missed.map(i => i.key))
  return [...missed, ...shuffle(itemsOf(lang, topic).filter(i => !taken.has(i.key)), rand)]
}

/**
 * A round of ten: from one topic, or ("Gemischt", `topic` left out) from all, each item drawing a topic weighted
 * towards his weak ones (11 − right of his last 10: an untried topic weighs most, and every topic can come).
 * Each item once; chosen while its topic is new to him, typed once he has 5 of his last 10 right.
 */
export function buildGrammarRound(lang: Lang, topic: string | undefined, progress: GrammarProgress, rand: () => number): RoundItem[] {
  const ids = topic === undefined ? GRAMMAR[lang].map(t => t.id) : [topic]
  const queues = new Map(ids.map(id => [id, queueOf(lang, id, progress, rand)]))
  const picked: GrammarItem[] = []
  while (picked.length < GRAMMAR_ROUND) {
    const open = ids.filter(id => queues.get(id)!.length > 0)
    if (open.length === 0) break
    const weights = open.map(id => 11 - rightOfLast10(progress[`${lang}:${id}`]))
    let at = rand() * weights.reduce((a, b) => a + b, 0)
    let chosen = open[open.length - 1]
    for (const [i, id] of open.entries()) {
      at -= weights[i]
      if (at < 0) { chosen = id; break }
    }
    picked.push(queues.get(chosen)!.shift()!)
  }
  return picked.map(item => toRoundItem(item, typesNow(progress[`${lang}:${item.topic}`]), rand))
}

const RECENT = 20
const MISSED = 20

/**
 * Lays one round's first answers over the record, as the server does (backend/app/grammar.py): per topic the last 20
 * (newest last); a missed item is kept to come back first, a right one leaves. Items of the other language, or not
 * shaped `<lang>:<topic>:<id>`, are skipped.
 */
export function layGrammar(progress: GrammarProgress, item: { lang: string; answers: { item: string; right: boolean }[] }): GrammarProgress {
  const next = { ...progress }
  for (const a of item.answers) {
    const parts = a.item.split(':')
    if (parts.length < 3 || parts[0] !== item.lang || !parts[1] || !parts.slice(2).join(':')) continue
    const topic = `${parts[0]}:${parts[1]}`
    const old = next[topic] ?? { recent: [], missed: [] }
    const missed = old.missed.filter(m => m !== a.item)
    next[topic] = {
      recent: [...old.recent, a.right].slice(-RECENT),
      missed: a.right ? missed : [...missed, a.item].slice(-MISSED),
    }
  }
  return next
}
