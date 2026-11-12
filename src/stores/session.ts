import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, type Api, type Me } from '@/services/api'

/**
 * Where the page stands with the server:
 *  loading    asking who plays
 *  ready      someone plays
 *  choose     no hub, and nobody picked yet
 *  no_access  logged in at the hub, but not allowed to play (or opened from outside the house)
 *  offline    the server doesn't answer
 *  leaving    on the way to the hub's login
 */
export type SessionStatus = 'loading' | 'ready' | 'choose' | 'no_access' | 'offline' | 'leaving'

// The browser goes to the hub's login at most this often: a login cookie that never arrives (the game opened at an
// address outside local.<domain>) would otherwise bounce between the hub and the game for ever
const LOGIN_GAP_MS = 10 * 60_000
const LOGIN_KEY = 'brightville.loginAt'

function mayGoToLogin(): boolean {
  try {
    const last = window.sessionStorage.getItem(LOGIN_KEY)
    if (last !== null && Date.now() - Number(last) < LOGIN_GAP_MS) return false
    window.sessionStorage.setItem(LOGIN_KEY, String(Date.now()))
    return true
  } catch {
    return true
  }
}

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('loading')
  const me = shallowRef<Me | null>(null)
  const api = shallowRef<Api | null>(null)
  /** The hub login is in its last week: pass through the hub once, at a moment that interrupts nothing */
  const renewWanted = ref(false)
  let go: (url: string) => void = url => window.location.assign(url)

  const person = computed(() => me.value?.person ?? null)
  const people = computed(() => me.value?.people ?? [])
  const isParent = computed(() => person.value?.role === 'PARENT')
  /** Without a hub, whoever holds the device can hand it to someone else */
  const canSwitch = computed(() => me.value?.mode === 'local')

  async function ask() {
    if (!api.value) return
    try {
      me.value = await api.value.me()
      status.value = me.value.person ? 'ready' : 'choose'
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && e.loginUrl && mayGoToLogin()) {
        status.value = 'leaving'
        go(e.loginUrl + encodeURIComponent(window.location.href))
      } else if (e instanceof ApiError && e.status === 403) {
        status.value = 'no_access'
      } else {
        status.value = 'offline'
      }
    }
  }

  function start(server: Api, navigate?: (url: string) => void) {
    api.value = server
    if (navigate) go = navigate
    return ask()
  }

  async function choose(personId: number) {
    try {
      await api.value?.choose(personId)
    } catch {
      return
    }
    await ask()
  }

  function wantRenew() {
    renewWanted.value = true
  }

  function navigate(url: string) {
    go(url)
  }

  function switchPerson() {
    if (canSwitch.value) status.value = 'choose'
  }

  return {
    status, me, api, person, people, isParent, canSwitch, renewWanted,
    start, retry: ask, choose, switchPerson, wantRenew, navigate,
  }
})
