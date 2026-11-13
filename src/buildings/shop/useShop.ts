import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import { starsSaid } from '@/core/diary'
import { numberWord } from '@/core/numbers'
import { TO_OPEN, shopMoney } from '@/core/outfits'
import { instruct, speak, stopSpeaking } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import type { BuyResult } from '@/stores/wardrobe'
import { onLeaveRequest } from '../leave'

/** Something a shop sells (stage 7 and 8): on one of three shelves, for a price in Stars */
export interface ShopItem {
  id: string
  name: string
  article: 'der' | 'die' | 'das' | 'pl'
  emoji: string
  shelf: 1 | 2 | 3
  price: number
}

export const SHELVES = [1, 2, 3] as const
const CONFETTI_MS = 2500

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const POSSESSIVE = { der: ['Der', 'ist deiner'], die: ['Die', 'ist deine'], das: ['Das', 'ist deins'], pl: ['Die', 'sind deine'] } as const
const yours = (o: ShopItem) => `${POSSESSIVE[o.article][0]} ${o.name} ${POSSESSIVE[o.article][1]}!`

/** What the voice says when the server refused; anything else (offline, unknown) is "try again" */
const REFUSED: Partial<Record<string, string>> = {
  owned: 'Das hast du schon.',
  bought_today: 'Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.',
  poor: 'Dafür hast du noch nicht genug Sterne.',
  shelf_locked: 'Dieses Regal ist noch zu.',
  locked: 'Erst lernen, dann einkaufen!',
}

export interface ShopOptions<T extends ShopItem> {
  items: T[]
  /** The ids she owns */
  owned: () => string[]
  shelfOpen: (shelf: 1 | 2 | 3, owned: string[]) => boolean
  /** One purchase a day, across both shops */
  boughtToday: () => boolean
  buy: (id: string) => Promise<BuyResult>
  /** Asks the server again for what she owns (her Stars are asked for here) */
  catchUp: () => Promise<void>
  /** Said when the shop opens */
  welcome: string
  /** Leaves the shop */
  leave: () => void
}

export interface Shop<T extends ShopItem> {
  items: T[]
  ownedIds: ComputedRef<string[]>
  trying: Ref<T | null>
  celebrating: Ref<boolean>
  canBuy: ComputedRef<boolean>
  ready: ComputedRef<boolean>
  open: (shelf: 1 | 2 | 3) => boolean
  tap: (o: T) => void
  buy: () => Promise<void>
}

/**
 * What both shops do between their tiles and the voice (stages 7 and 8): tapping tries an item, the ✔️ buys it, one
 * purchase a day, saved Stars count half (the server decides, core/outfits.ts shows what it will decide), the cheer,
 * catching up with the server, and leaving with Escape or the leave button. Each shop shows the item tried its own
 * way (on her character, in her room).
 */
export function useShop<T extends ShopItem>(opts: ShopOptions<T>): Shop<T> {
  const player = usePlayerStore()
  const ownedIds = computed(() => opts.owned())
  const open = (shelf: 1 | 2 | 3) => opts.shelfOpen(shelf, ownedIds.value)
  const money = computed(() => shopMoney(player.stars, player.savings))

  /** What she is trying, not bought (yet) */
  const trying = ref<T | null>(null) as Ref<T | null>
  const busy = ref(false)
  const celebrating = ref(false)
  const canBuy = computed(() => !!trying.value && !ownedIds.value.includes(trying.value.id) && open(trying.value.shelf))
  const ready = computed(() => canBuy.value && !opts.boughtToday() && money.value >= trying.value!.price)

  let closed = false
  let stopLeaveRequests = () => {}
  let confettiTimer: ReturnType<typeof setTimeout> | undefined

  function tap(o: T) {
    if (busy.value) return
    if (!open(o.shelf)) {
      // The shelf above is locked too: its items can't be bought yet, the way starts at the top
      if (!open((o.shelf - 1) as 1 | 2)) {
        void speak('Dieses Regal geht später auf. Fang ganz oben an!')
        return
      }
      const above = ownedIds.value.filter(id => opts.items.find(x => x.id === id)?.shelf === o.shelf - 1).length
      const more = TO_OPEN - above
      void speak(more === 1
        ? 'Kauf noch ein Teil von oben, dann geht dieses Regal auf.'
        : `Kauf noch ${numberWord(more)} Teile von oben, dann geht dieses Regal auf.`)
      return
    }
    // A second tap puts back what she is trying
    if (trying.value?.id === o.id) {
      trying.value = null
      return
    }
    trying.value = o
    void instruct(ownedIds.value.includes(o.id) ? `${o.name}. Das hast du schon.` : `${o.name}. ${cap(starsSaid(o.price))}.`)
  }

  async function buy() {
    const o = trying.value
    if (!o || !canBuy.value || busy.value) return
    if (opts.boughtToday()) {
      void speak(REFUSED.bought_today!)
      return
    }
    if (money.value < o.price) {
      const missing = o.price - money.value
      void speak(`Dafür brauchst du noch ${missing === 1 ? 'einen Stern' : starsSaid(missing)}.`)
      return
    }
    busy.value = true
    const shelvesBefore = SHELVES.filter(open)
    const result = await opts.buy(o.id)
    // The answer got lost: maybe it went through. Ask; if it is hers now, it's a purchase like any other
    let bought = result === 'ok'
    if (result === 'offline' && !closed) {
      await catchUp()
      bought = ownedIds.value.includes(o.id)
    }
    busy.value = false
    if (closed) return
    if (bought) {
      trying.value = null
      const newShelf = SHELVES.some(s => open(s) && !shelvesBefore.includes(s))
      void speak(newShelf ? `${yours(o)} Ein neues Regal!` : yours(o))
      celebrating.value = true
      clearTimeout(confettiTimer)
      confettiTimer = setTimeout(() => { celebrating.value = false }, CONFETTI_MS)
      return
    }
    void speak(REFUSED[result] ?? 'Das hat gerade nicht geklappt. Versuch es nochmal.')
    // This page didn't know what the server knows (another device, a stale view): catch up
    if (result !== 'offline') void catchUp()
  }

  async function catchUp() {
    await Promise.all([opts.catchUp(), player.refresh()])
    if (trying.value && ownedIds.value.includes(trying.value.id)) trying.value = null
  }

  function leave() {
    if (closed) return
    closed = true
    window.removeEventListener('keydown', onKey)
    stopLeaveRequests()
    stopSpeaking()
    opts.leave()
  }

  function onKey(e: KeyboardEvent) {
    if (e.code === 'Escape' && !e.repeat) leave()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey)
    stopLeaveRequests = onLeaveRequest(leave)
    void instruct(opts.welcome)
    // What she bought on another device, or what a lost answer left out, shows here
    void catchUp()
  })
  onBeforeUnmount(() => {
    closed = true
    window.removeEventListener('keydown', onKey)
    stopLeaveRequests()
    clearTimeout(confettiTimer)
  })

  return { items: opts.items, ownedIds, trying, celebrating, canBuy, ready, open, tap, buy }
}
