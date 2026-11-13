<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { COLORS, PAPER, SIZES, drawStroke, isShape, type Point, type Size, type Stroke, type Tool } from '@/core/drawing'
import { createPenFilter, penEnd, penStart } from '@/core/penFilter'
import type { Api } from '@/services/api'
import { paintingStore, type GalleryItem } from '@/services/paintingStore'
import { instruct, stopSpeaking } from '@/services/tts'
import { useSessionStore } from '@/stores/session'
import { createEffort } from '../effort'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'

// Free drawing: a gallery of this child's paintings (kept on the server, the same on every device), and a sheet.
// A free building: nothing is earned or paid.
const props = defineProps<{
  /** Whose paintings; the person playing when not given */
  owner?: number
  /** The server; the session's when not given */
  api?: Api
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const session = props.owner === undefined || !props.api ? useSessionStore() : null
const owner = props.owner ?? session?.person?.id ?? 0
const store = paintingStore((props.api ?? session?.api)!, owner)

const HELLO = 'Malen! Mach ein neues Bild, oder tipp auf ein Bild und mal weiter.'
const ON_SHEET = 'Mal, was du magst!'
const TOOL_BUTTONS: { id: Tool; icon: string; label: string }[] = [
  { id: 'brush', icon: '🖌️', label: 'Pinsel' },
  { id: 'pencil', icon: '✏️', label: 'Stift' },
  { id: 'eraser', icon: '🧽', label: 'Radierer' },
  { id: 'line', icon: '➖', label: 'Linie' },
  { id: 'circle', icon: '⭕', label: 'Kreis' },
  { id: 'rect', icon: '⬜', label: 'Viereck' },
  { id: 'triangle', icon: '🔺', label: 'Dreieck' },
  { id: 'star', icon: '⭐', label: 'Stern' },
  { id: 'heart', icon: '❤️', label: 'Herz' },
]
// The size buttons show small, medium and large, whatever the tool's real widths are
const DOTS: Record<Size, number> = { S: 10, M: 20, L: 32 }
const MIN_SHAPE = 6 // px; a shape dragged less than this was just a tap
const THUMB_WIDTH = 320
// What the server takes at most (backend/app/paintings.py, MAX_IMAGE_BYTES), and the JPEG used above it
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const JPEG_QUALITY = 0.92

const screen = ref<'gallery' | 'sheet'>('gallery')
const paintings = ref<GalleryItem[]>([])
const loaded = ref(false)

const area = ref<HTMLElement | null>(null)
const paper = ref<HTMLCanvasElement | null>(null)
const overlay = ref<HTMLCanvasElement | null>(null)
const tool = ref<Tool>('brush')
const size = ref<Size>('M')
const color = ref(COLORS[2])
const strokes = ref<Stroke[]>([])
/** Strokes over the whole visit, on every sheet: whether it goes into the logbook */
const effort = createEffort()

let closed = false
let paintingId: string | undefined
/** A saved painting being continued */
let background: HTMLImageElement | null = null
/** The stroke being drawn */
let current: Stroke | null = null
let changed = false
let dpr = 1
let filter = createPenFilter()
/** The save in progress, so going back waits for it */
let saving: Promise<void> = Promise.resolve()

async function refresh() {
  paintings.value = await store.list()
  loaded.value = true
}

async function openSheet(id?: string) {
  if (closed) return
  paintingId = id
  background = null
  strokes.value = []
  changed = false
  current = null
  filter = createPenFilter()
  screen.value = 'sheet'
  void instruct(ON_SHEET)
  await nextTick()
  resize()
  if (!id) return
  const source = await store.image(id)
  if (!source || closed || paintingId !== id) return
  const img = new Image()
  img.onload = () => {
    if (paintingId !== id) return
    background = img
    redraw()
  }
  img.src = source
}

async function remove(p: GalleryItem) {
  if (!window.confirm('Dieses Bild löschen?')) return
  await store.remove(p.id)
  await refresh()
}

// Picking a colour while the eraser is in hand goes back to the brush
function pickColor(c: string) {
  color.value = c
  if (tool.value === 'eraser') tool.value = 'brush'
}

function dotStyle(s: Size) {
  const w = DOTS[s]
  return { width: `${w}px`, height: `${w}px`, background: tool.value === 'eraser' ? '#bbb' : color.value }
}

function context(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  const ctx = canvas?.getContext('2d') ?? null
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function resize() {
  const el = area.value
  if (!el || !paper.value || !overlay.value) return
  dpr = window.devicePixelRatio || 1
  for (const c of [paper.value, overlay.value]) {
    c.width = el.clientWidth * dpr
    c.height = el.clientHeight * dpr
    c.style.width = `${el.clientWidth}px`
    c.style.height = `${el.clientHeight}px`
  }
  redraw()
}

// Paper, the saved painting (if any) as big as fits, then every stroke
function redraw() {
  const canvas = paper.value
  const ctx = context(canvas)
  if (!canvas || !ctx) return
  const w = canvas.width / dpr
  const h = canvas.height / dpr
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)
  if (background) {
    const s = Math.min(w / background.width, h / background.height)
    const bw = background.width * s
    const bh = background.height * s
    ctx.drawImage(background, (w - bw) / 2, (h - bh) / 2, bw, bh)
  }
  for (const s of strokes.value) drawStroke(ctx, s)
}

function point(e: PointerEvent): Point {
  const r = paper.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

const contact = (e: PointerEvent) => Math.max(e.width || 0, e.height || 0)

function onDown(e: PointerEvent) {
  if (!penStart(filter, e.pointerId, contact(e))) return
  paper.value?.setPointerCapture?.(e.pointerId)
  current = { tool: tool.value, size: size.value, color: color.value, points: [point(e)] }
  drawCurrent()
}

function onMove(e: PointerEvent) {
  if (!current || e.pointerId !== filter.pen) return
  if (isShape(current.tool)) {
    current.points = [current.points[0], point(e)] // from where the drag started to here
  } else {
    const samples = e.getCoalescedEvents?.() ?? []
    for (const s of samples.length ? samples : [e]) current.points.push(point(s))
  }
  drawCurrent()
}

function onUp(e: PointerEvent) {
  if (!penEnd(filter, e.pointerId) || !current) return
  const done = current
  current = null
  if (isShape(done.tool)) {
    const [a, b] = [done.points[0], point(e)]
    done.points = [a, b]
    if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_SHAPE) {
      drawCurrent()
      return
    }
  }
  strokes.value = [...strokes.value, done]
  effort.mark()
  const ctx = context(paper.value)
  if (ctx) drawStroke(ctx, done)
  drawCurrent()
  changed = true
}

// The stroke in progress lives on its own layer, so a see-through pencil isn't drawn over itself
function drawCurrent() {
  const canvas = overlay.value
  const ctx = context(canvas)
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (current) drawStroke(ctx, current)
}

function undo() {
  strokes.value = strokes.value.slice(0, -1)
  changed = true
  redraw()
}

function clearAll() {
  if (!window.confirm('Alles wegmachen und neu anfangen?')) return
  strokes.value = []
  background = null
  changed = true
  redraw()
}

function thumbnail(canvas: HTMLCanvasElement): string {
  const t = document.createElement('canvas')
  t.width = THUMB_WIDTH
  t.height = Math.round((THUMB_WIDTH * canvas.height) / canvas.width) || THUMB_WIDTH
  t.getContext('2d')?.drawImage(canvas, 0, 0, t.width, t.height)
  return t.toDataURL('image/jpeg', 0.7)
}

/**
 * The sheet as PNG, which keeps every line sharp; a sheet too large for the server that way (a big, busy one on a
 * sharp screen) as JPEG, which the server refuses never.
 */
function picture(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL('image/png')
  const bytes = ((png.length - png.indexOf(',') - 1) * 3) / 4
  return bytes <= MAX_IMAGE_BYTES ? png : canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/** Keeps the sheet when something was drawn; the picture is taken now, while the canvas is still there. */
function save(): Promise<void> {
  const canvas = paper.value
  if (!changed || !canvas) return saving
  changed = false
  const painting = { id: paintingId, image: picture(canvas), thumb: thumbnail(canvas) }
  saving = saving
    .then(() => store.save(painting))
    .then(id => { paintingId = id })
    .catch(() => undefined)
  return saving
}

async function toGallery() {
  const kept = save()
  screen.value = 'gallery'
  loaded.value = false
  await kept
  if (!closed) await refresh()
}

/** From the sheet back to the gallery; from the gallery back to the town */
function back() {
  if (closed) return
  if (screen.value === 'sheet') {
    void toGallery()
    return
  }
  shutDown()
  emit('finished', { stars: 0, made: effort.counts() })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape' && !e.repeat) back()
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', resize)
  stopLeaveRequests()
  stopSpeaking()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', resize)
  stopLeaveRequests = onLeaveRequest(back)
  void instruct(HELLO)
  void refresh()
})
// Before unmounting, while the canvas is still there: keep what was drawn
onBeforeUnmount(() => {
  if (screen.value === 'sheet') void save()
  shutDown()
})
</script>

<template>
  <div class="malen">
    <div
      v-if="screen === 'gallery'" class="gallery" data-test="gallery" :data-loaded="loaded"
      :data-empty="loaded && paintings.length === 0"
    >
      <button class="new" data-test="new" aria-label="Neues Bild" @click="openSheet()">➕</button>
      <div v-for="p in paintings" :key="p.id" class="painting" data-test="painting">
        <img :src="p.thumb" alt="Bild" @click="openSheet(p.id)" />
        <button class="delete" data-test="delete" aria-label="Bild löschen" @click="remove(p)">🗑</button>
        <span v-if="p.waiting" class="waiting" title="Wartet auf den Server">⏳</span>
      </div>
    </div>

    <template v-else>
      <div class="bar">
        <button
          v-for="t in TOOL_BUTTONS" :key="t.id" class="tool" :data-active="tool === t.id" :aria-label="t.label"
          @click="tool = t.id"
        >{{ t.icon }}</button>
        <button
          v-for="s in SIZES" :key="s" class="tool" :data-active="size === s" :aria-label="`Grösse ${s}`"
          @click="size = s"
        ><span class="dot" :style="dotStyle(s)" /></button>
        <button class="tool" data-test="undo" :disabled="!strokes.length" aria-label="Zurück" @click="undo">↩️</button>
        <button class="tool" aria-label="Alles weg" @click="clearAll">🗑</button>
        <button class="tool done" data-test="done" aria-label="Fertig" @click="back">✅</button>
      </div>

      <div ref="area" class="area">
        <canvas
          ref="paper" class="paper" data-test="paper" :data-strokes="strokes.length"
          @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
        />
        <canvas ref="overlay" class="overlay" />
      </div>

      <div class="colors">
        <button
          v-for="c in COLORS" :key="c" class="color" :data-active="color === c" :style="{ background: c }"
          :aria-label="c" @click="pickColor(c)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.malen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f3fbfa;
}
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
  padding: 90px 16px 24px;
  overflow-y: auto;
}
.new, .painting {
  aspect-ratio: 4 / 3;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}
.new {
  font-size: 3rem;
  background: white;
  border: 3px dashed #26a69a;
  cursor: pointer;
}
/* No painting yet: the one thing to tap is big, in the middle (UX review) */
.gallery[data-empty='true'] { grid-template-columns: min(60vw, 440px); place-content: center; height: 100%; box-sizing: border-box; }
.gallery[data-empty='true'] .new { font-size: 6rem; border-width: 5px; }
.painting { background: white; border: 3px solid #cfe9e6; box-shadow: 0 3px 0 #b8dcd8; }
.painting img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer; }
.delete {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  font-size: 1.1rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ddd;
}
.waiting {
  position: absolute;
  bottom: 6px;
  left: 6px;
  font-size: 1.3rem;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  /* Room on the left for the leave button */
  padding: 10px 12px 6px 84px;
  background: #e0f2f1;
}
.tool {
  min-width: 48px;
  min-height: 48px;
  border-radius: 14px;
  font-size: 1.4rem;
  background: white;
  border: 3px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tool[data-active='true'] { border-color: #26a69a; }
.tool:disabled { opacity: 0.4; }
.done { background: #26a69a; }
.dot { display: block; border-radius: 50%; border: 1px solid #ccc; }
.area {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 8px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.paper, .overlay { position: absolute; inset: 0; display: block; }
.paper { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.overlay { pointer-events: none; }
.colors {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
}
.color { width: 44px; height: 44px; border-radius: 50%; border: 3px solid #ddd; }
.color[data-active='true'] { border-color: #333; transform: scale(1.12); }
</style>
