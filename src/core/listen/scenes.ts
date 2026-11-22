import en from '../../../shared/listen/en.json'
import fr from '../../../shared/listen/fr.json'
import type { Lang } from '@/core/vocab/types'

/**
 * A listening scene (shared/listen/<lang>.json): 1–3 lines in the language (a line may name its speaker, "A: " /
 * "B: "), a question in German about something said, four short answers and the index of the right one
 */
export interface Scene {
  id: string
  lines: string[]
  question: string
  answers: string[]
  right: number
}

/** A topic of scenes: the same ids and German names as the built-in word lists */
export interface SceneTopic {
  id: string
  name: string
  scenes: Scene[]
}

export const SCENES: Record<Lang, SceneTopic[]> = { en: en.topics, fr: fr.topics }

/** A scene's key in his record: `<lang>:<topic>:<id>` */
export function sceneKey(lang: Lang, topic: string, id: string): string {
  return `${lang}:${topic}:${id}`
}

/** The scenes of one language, of one topic or all ("Gemischt") */
export function allScenes(lang: Lang, topic?: string): { key: string; topic: string; scene: Scene }[] {
  return SCENES[lang]
    .filter(t => topic === undefined || t.id === topic)
    .flatMap(t => t.scenes.map(scene => ({ key: sceneKey(lang, t.id, scene.id), topic: t.id, scene })))
}
