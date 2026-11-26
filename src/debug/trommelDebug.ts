import { beatTimes, findOnsets, LEAD_IN, type RhythmTask } from '@/core/rhythm'
import { openMicrophone, type Level, type Microphone } from '@/services/microphone'
import { playBeat, unlockAudio, type SoundKind } from '@/services/sound'

// A test of the Trommelhaus on this device, for finding out why sound or the microphone doesn't work: the house's own
// code plays its beats (calibration, four loud, eight quiet, as when she claps along) while the microphone's loudness
// is logged and its sound recorded. Everything stays on the device: the result is a file to download (or copy).
// Opened at /debug/trommel.html; not linked from the game.

const KEEP: RhythmTask = { type: 'keep', bpm: 90 }
/** As the Trommelhaus: its quiet drum heard three times (the quietest counts), claps along must be this much louder, the room's first readings */
const CALIBRATE_BEATS = 3
const CALIBRATE_GAP_MS = 250
const OVER_HOUSE = 2
const FLOOR_READINGS = 5
const FLOOR_AT_MOST = 0.02
const FREE_MS = 4000

interface Event { t: number; what: string; detail?: unknown }

const t0 = performance.now()
const now = () => Math.round(performance.now() - t0)
const events: Event[] = []
const levels: Level[] = []
let ctx: AudioContext | null = null

const root = document.getElementById('debug')!
root.innerHTML = `
  <style>
    body { font: 18px system-ui, sans-serif; margin: 0; background: #fde9e4; color: #4a2a20; }
    main { max-width: 760px; margin: 0 auto; padding: 24px; }
    button { font: inherit; font-weight: 700; padding: 18px 28px; border: 0; border-radius: 18px; background: #ffb300; margin: 6px 6px 6px 0; }
    button[hidden] { display: none; }
    #stage { display: flex; align-items: center; gap: 32px; margin: 24px 0; }
    #ring { width: 140px; height: 140px; border-radius: 50%; background: #fff4f1; border: 8px solid #f0c4b8; transition: transform .06s linear; }
    #beat { width: 70px; height: 70px; border-radius: 50%; background: #ffe0b2; }
    #beat.on { background: #ffb300; }
    #say { font-size: 26px; font-weight: 700; min-height: 1.4em; }
    pre { white-space: pre-wrap; background: #fff; padding: 14px; border-radius: 12px; font-size: 14px; }
  </style>
  <h1>Trommelhaus test</h1>
  <p>Tap <b>Start</b>, allow the microphone, and follow what it says. About 15 seconds. Then download the result.</p>
  <button id="start">Start</button>
  <button id="resume" hidden>Sound is off: tap here</button>
  <div id="stage"><div id="ring"></div><div id="beat"></div><div id="say"></div></div>
  <button id="download" hidden>Download result</button>
  <button id="copy" hidden>Copy result</button>
  <pre id="out"></pre>`
const $ = (id: string) => document.getElementById(id) as HTMLElement
const say = (text: string) => { $('say').textContent = text; log('say', text) }

function log(what: string, detail?: unknown) {
  events.push({ t: now(), what, ...(detail === undefined ? {} : { detail }) })
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function beat(kind: SoundKind) {
  playBeat(kind)
  log('beat', kind)
  $('beat').classList.add('on')
  setTimeout(() => $('beat').classList.remove('on'), 120)
}

function audioState(where: string) {
  log('audio', { where, state: ctx?.state ?? 'none' })
}

function environment() {
  const nav = navigator as Navigator & { audioSession?: { type?: string } }
  return {
    userAgent: navigator.userAgent,
    audioSession: nav.audioSession?.type ?? null,
    sampleRate: ctx?.sampleRate ?? null,
    baseLatency: ctx?.baseLatency ?? null,
    outputLatency: (ctx as AudioContext & { outputLatency?: number } | null)?.outputLatency ?? null,
  }
}

// ---- Recording what the microphone hears ----

let recorder: MediaRecorder | null = null
const chunks: Blob[] = []

function record(stream: MediaStream | undefined) {
  if (!stream || typeof MediaRecorder === 'undefined') return log('recording', 'unavailable')
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t))
  recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  recorder.start()
  log('recording', recorder.mimeType)
}

function stopRecording(): Promise<{ type: string; base64: string } | null> {
  const r = recorder
  if (!r) return Promise.resolve(null)
  return new Promise(resolve => {
    r.onstop = () => {
      const blob = new Blob(chunks, { type: r.mimeType })
      const reader = new FileReader()
      reader.onload = () => resolve({ type: r.mimeType, base64: String(reader.result).split(',')[1] ?? '' })
      reader.readAsDataURL(blob)
    }
    r.stop()
  })
}

// ---- The test ----

let mic: Microphone | null = null

/** The Trommelhaus's buttons answer on pointerdown: the test starts the same way */
$('start').addEventListener('pointerdown', () => void run(), { once: true })

async function run() {
  $('start').hidden = true
  ctx = unlockAudio()
  audioState('pointerdown, right after unlocking')
  if (ctx) ctx.onstatechange = () => audioState('changed')
  window.addEventListener('pointerup', () => audioState('pointerup after start'), { once: true })
  mic = await openMicrophone()
  log('microphone', mic ? 'open' : 'refused or missing')
  audioState('after the microphone opened')
  if (!mic) {
    say('No microphone. Is the page open over https?')
    return finish()
  }
  record(mic.stream)
  mic.listen(l => {
    levels.push({ t: Math.round(l.t - t0), level: Number(l.level.toFixed(4)) })
    $('ring').style.transform = `scale(${0.6 + Math.min(1, Math.sqrt(l.level) * 1.6) * 0.9})`
  })
  await wait(300)
  audioState('300 ms later')
  if (ctx && ctx.state !== 'running') {
    // The question this answers: does the iPad only start sound at a tap's end, not at pointerdown?
    $('resume').hidden = false
    say('Sound is off. Tap the button.')
    await new Promise<void>(resolve => $('resume').addEventListener('click', () => {
      void ctx?.resume()
      audioState('click on "sound is off"')
      resolve()
    }, { once: true }))
    $('resume').hidden = true
    await wait(300)
    audioState('300 ms after the click')
  }

  say('Quiet please…')
  log('phase', 'room')
  await wait(1000)

  log('phase', 'calibrate')
  for (let i = 0; i < CALIBRATE_BEATS; i++) {
    beat('softDrum')
    await wait(CALIBRATE_GAP_MS)
  }

  say('Listen: 4 loud, then clap along with the quiet ones!')
  await wait(1500)
  log('phase', 'keep')
  const times = beatTimes(KEEP)
  times.forEach((at, i) => setTimeout(() => beat(i < LEAD_IN ? 'drum' : 'softDrum'), at))
  setTimeout(() => say('Clap!'), times[LEAD_IN] - 200)
  await wait(times[times.length - 1] + 1500)

  log('phase', 'free')
  say('Now clap 3 times, no drum')
  await wait(FREE_MS)
  log('phase', 'end')
  say('Done')
  await finish()
}

// ---- The result ----

function analysis() {
  const phase = (name: string) => events.find(e => e.what === 'phase' && e.detail === name)?.t
  const within = (from?: number, to?: number) => levels.filter(l => from !== undefined && l.t >= from && (to === undefined || l.t < to))
  const peak = (ls: Level[]) => Math.max(0, ...ls.map(l => l.level))
  const room = within(phase('room'), phase('calibrate'))
  const floor = Math.min(FLOOR_AT_MOST, ...room.slice(0, FLOOR_READINGS).map(l => l.level))
  const calibrated = phase('calibrate') ?? 0
  const houseLevel = Math.min(...Array.from({ length: CALIBRATE_BEATS }, (_, i) =>
    peak(within(calibrated + i * CALIBRATE_GAP_MS, calibrated + (i + 1) * CALIBRATE_GAP_MS))))
  const beats = events.filter(e => e.what === 'beat').map(e => ({
    t: e.t, kind: e.detail, peakHeard: peak(levels.filter(l => l.t >= e.t && l.t < e.t + 200)),
  }))
  const keep = within(phase('keep'), phase('free'))
  const free = within(phase('free'), phase('end'))
  return {
    roomNoise: { floor, peak: peak(room) },
    houseQuietDrumHeard: houseLevel,
    clapThresholdWhileHouseDrums: Math.max(floor * 3, 0.05, houseLevel * OVER_HOUSE),
    beats,
    clapsFoundWhileKeeping: findOnsets(keep, floor, houseLevel * OVER_HOUSE),
    soundsFoundWhileKeepingWithoutHouseFilter: findOnsets(keep, floor),
    clapsFoundFree: findOnsets(free, floor),
    levelsAllZero: levels.length > 0 && levels.every(l => l.level === 0),
  }
}

async function finish() {
  mic?.close()
  const audio = await stopRecording()
  const result = { when: new Date().toISOString(), environment: environment(), analysis: analysis(), events, levels, audio }
  const a = result.analysis
  $('out').textContent = [
    `Audio: ${events.filter(e => e.what === 'audio').map(e => `${(e.detail as { where: string }).where}: ${(e.detail as { state: string }).state}`).join('\n       ')}`,
    `Readings: ${levels.length}${a.levelsAllZero ? ' (all zero: the microphone hears nothing)' : ''}`,
    `Room noise: ${a.roomNoise.floor.toFixed(3)} (peak ${a.roomNoise.peak.toFixed(3)})`,
    `Quiet drum heard at: ${a.houseQuietDrumHeard.toFixed(3)}`,
    `Claps found while keeping the beat: ${a.clapsFoundWhileKeeping.length} (of 8)`,
    `Claps found at the end: ${a.clapsFoundFree.length} (of 3)`,
  ].join('\n')
  const text = JSON.stringify(result)
  $('download').hidden = false
  $('copy').hidden = false
  $('download').onclick = () => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    link.download = `trommel-test-${Date.now()}.json`
    link.click()
  }
  $('copy').onclick = () => void navigator.clipboard?.writeText(text).then(() => { $('copy').textContent = 'Copied' })
}
