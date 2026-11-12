// The family hub renews a login that is in its last week when the browser passes through it once.
const KEY = 'brightville.renewedAt'
const DAY_MS = 24 * 3600 * 1000

/**
 * Sends the browser through the hub's login, at most once a day: a renewal that doesn't take must not loop.
 * Without storage it never goes, for the same reason. True when it went.
 */
export function renewOnce(loginUrl: string, go: (url: string) => void, storage?: Storage, now = Date.now()): boolean {
  try {
    const store = storage ?? window.localStorage
    const last = store.getItem(KEY)
    if (last !== null && now - Number(last) < DAY_MS) return false
    store.setItem(KEY, String(now))
  } catch {
    return false
  }
  go(loginUrl + encodeURIComponent(window.location.href))
  return true
}
