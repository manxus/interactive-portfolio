import { useEffect, useRef } from 'react'

/** Set to true on Space (keydown, no repeat); consume in the game loop. */
export function useJumpPending() {
  const pending = useRef(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code !== 'Space') return
      e.preventDefault()
      pending.current = true
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [])

  return pending
}
