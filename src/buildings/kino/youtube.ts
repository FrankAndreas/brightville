// YouTube's privacy-enhanced player: no cookies until the film plays, no recommendations from us

export const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com'

export function thumbnail(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`
}

/** The player for one film: starts at once, related films only from the same channel, and it tells us when it ends. */
export function playerUrl(youtubeId: string, pageOrigin: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: pageOrigin,
  })
  return `${PLAYER_ORIGIN}/embed/${encodeURIComponent(youtubeId)}?${params}`
}

/** True for the player's message that the film has ended (state 0), in either of the forms it sends. */
export function endedMessage(data: unknown): boolean {
  if (typeof data !== 'string') return false
  let message: { event?: unknown; info?: unknown }
  try {
    message = JSON.parse(data)
  } catch {
    return false
  }
  if (message?.event === 'onStateChange') return message.info === 0
  if (message?.event === 'infoDelivery' && typeof message.info === 'object' && message.info !== null) {
    return (message.info as { playerState?: unknown }).playerState === 0
  }
  return false
}
