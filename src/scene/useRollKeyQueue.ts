import { useEffect, useRef } from 'react'

export type RollKey = 'w' | 'a' | 's' | 'd'

export function useRollKeyQueue() {
  const queue = useRef<RollKey[]>([])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      let k: RollKey | null = null
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          k = 'w'
          break
        case 'KeyA':
        case 'ArrowLeft':
          k = 'a'
          break
        case 'KeyS':
        case 'ArrowDown':
          k = 's'
          break
        case 'KeyD':
        case 'ArrowRight':
          k = 'd'
          break
        default:
          break
      }
      if (k) queue.current.push(k)
    }

    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [])

  return queue
}
