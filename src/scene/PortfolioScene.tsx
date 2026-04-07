import { useLayoutEffect, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { findSpawnCenter } from './collision'
import { World } from './World'
import { PlayerRoll } from './PlayerRoll'
import { Player } from './Player'
import { useRollKeyQueue } from './useRollKeyQueue'
import { useJumpPending } from './useJumpPending'

type PortfolioSceneProps = {
  selectedId: string | null
  onSelectExhibit: (id: string) => void
}

export function PortfolioScene({
  selectedId,
  onSelectExhibit,
}: PortfolioSceneProps) {
  const [spawn] = useState(() => findSpawnCenter())
  const playerPositionRef = useRef(new Vector3().copy(spawn))
  const playerQuaternionRef = useRef(new Quaternion())
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const keyQueue = useRollKeyQueue()
  const jumpPendingRef = useJumpPending()

  useLayoutEffect(() => {
    playerPositionRef.current.copy(spawn)
    playerQuaternionRef.current.identity()
  }, [spawn])

  return (
    <>
      <World selectedId={selectedId} onSelectExhibit={onSelectExhibit} />
      <Player
        positionRef={playerPositionRef}
        quaternionRef={playerQuaternionRef}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.08}
        minDistance={12}
        maxDistance={12}
        target={[spawn.x, spawn.y, spawn.z]}
      />
      <PlayerRoll
        playerPositionRef={playerPositionRef}
        playerQuaternionRef={playerQuaternionRef}
        controlsRef={controlsRef}
        keyQueue={keyQueue}
        jumpPendingRef={jumpPendingRef}
      />
    </>
  )
}
