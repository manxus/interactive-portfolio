import { useEffect, useRef } from 'react'
import { isTypingTarget } from './isTypingTarget'

export type RollKey = 'w' | 'a' | 's' | 'd'

function rollKeyFromEvent(e: KeyboardEvent): RollKey | null {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'w'
    case 'KeyA':
    case 'ArrowLeft':
      return 'a'
    case 'KeyS':
    case 'ArrowDown':
      return 's'
    case 'KeyD':
    case 'ArrowRight':
      return 'd'
    default:
      break
  }
  // Layout-friendly fallback (e.g. AZERTY types different letters on same codes)
  if (e.key.length === 1) {
    const ch = e.key.toLowerCase()
    if (ch === 'w' || ch === 'a' || ch === 's' || ch === 'd') return ch
  }
  return null
}

/**
 * @param enabled When false (e.g. dev build mode), keys are ignored and the queue is cleared.
 */
export function useRollKeyQueue(enabled: boolean) {
  const queue = useRef<RollKey[]>([])

  useEffect(() => {
    if (!enabled) {
      queue.current.length = 0
      return
    }

    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (isTypingTarget(e.target)) return
      const k = rollKeyFromEvent(e)
      if (!k) return
      e.preventDefault()
      queue.current.push(k)
    }

    window.addEventListener('keydown', onDown, { capture: true })
    return () => window.removeEventListener('keydown', onDown, { capture: true })
  }, [enabled])

  return queue
}
