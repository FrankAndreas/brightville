export interface DeviceCaps {
  camera: boolean
  touch: boolean
  keyboard: boolean
}

/** What this device can do, as far as the browser tells without asking for permission. */
export function detectDevice(): DeviceCaps {
  return {
    // Missing on pages that are neither HTTPS nor localhost
    camera: typeof navigator.mediaDevices?.getUserMedia === 'function',
    touch: (navigator.maxTouchPoints ?? 0) > 0,
    // A mouse or trackpad is the best available sign of a real keyboard
    keyboard: typeof window.matchMedia === 'function' && window.matchMedia('(any-hover: hover)').matches,
  }
}
