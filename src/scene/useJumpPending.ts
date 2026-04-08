import { useEffect, useRef } from 'react'
import { isTypingTarget } from './isTypingTarget'

/** Set to true on Space (keydown, no repeat); consume in the game loop. */
export function useJumpPending() {
  const pending = useRef(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code !== 'Space') return
      if (isTypingTarget(e.target)) return
      const el = e.target
      if (
        el instanceof HTMLInputElement &&
        (el.type === 'checkbox' || el.type === 'radio')
      ) {
        return
      }
      e.preventDefault()
      pending.current = true
    }
    window.addEventListener('keydown', onDown, { capture: true })
    return () => window.removeEventListener('keydown', onDown, { capture: true })
  }, [])

  return pending
}
