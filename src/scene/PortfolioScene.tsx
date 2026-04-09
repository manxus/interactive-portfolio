import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { PortfolioEntry } from '../data/portfolio'
import type { TerrainVoxel } from '../data/terrain'
import { findSpawnCenter, setWorldCollision } from './collision'
import { World } from './World'
import { PlayerRoll } from './PlayerRoll'
import { Player } from './Player'
import { useRollKeyQueue } from './useRollKeyQueue'
import { useJumpPending } from './useJumpPending'
import { ScenePostFX } from './ScenePostFX'
import type { EditorBrushState } from '../editor/brushCells'
import {
  TerrainEditor,
  type EditorPlaceKind,
  type EditorTool,
} from './TerrainEditor'

type PortfolioSceneProps = {
  terrainVoxels: TerrainVoxel[]
  portfolioEntries: PortfolioEntry[]
  draftExhibits: PortfolioEntry[]
  onDraftExhibitsChange: (next: PortfolioEntry[]) => void
  staticExhibitKeys: Set<string>
  selectedId: string | null
  onSelectEntry: (id: string) => void
  buildMode: boolean
  editorTool: EditorTool
  editorPlaceKind: EditorPlaceKind
  editorColor: string
  editorBrush: EditorBrushState
  onTerrainChange: (next: TerrainVoxel[]) => void
}

export function PortfolioScene({
  terrainVoxels,
  portfolioEntries,
  draftExhibits,
  onDraftExhibitsChange,
  staticExhibitKeys,
  selectedId,
  onSelectEntry,
  buildMode,
  editorTool,
  editorPlaceKind,
  editorColor,
  editorBrush,
  onTerrainChange,
}: PortfolioSceneProps) {
  const dev = import.meta.env.DEV
  const editorCam = dev && buildMode
  const movementKeysEnabled = !editorCam

  const [spawn] = useState(() => findSpawnCenter())
  const keyQueue = useRollKeyQueue(movementKeysEnabled)
  const playerPositionRef = useRef(new Vector3().copy(spawn))
  const playerQuaternionRef = useRef(new Quaternion())
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const jumpPendingRef = useJumpPending()
  const [terrainEraseHoverKey, setTerrainEraseHoverKey] = useState<
    string | null
  >(null)
  const [draftEraseHoverId, setDraftEraseHoverId] = useState<string | null>(
    null,
  )

  const onEraseHover = useCallback(
    (h: { terrainKey: string | null; draftExhibitId: string | null }) => {
      setTerrainEraseHoverKey(h.terrainKey)
      setDraftEraseHoverId(h.draftExhibitId)
    },
    [],
  )

  useLayoutEffect(() => {
    playerPositionRef.current.copy(spawn)
    playerQuaternionRef.current.identity()
  }, [spawn])

  useLayoutEffect(() => {
    setWorldCollision(terrainVoxels, draftExhibits)
  }, [terrainVoxels, draftExhibits])

  const applyOrbitMouseButtons = useCallback(() => {
    const c = controlsRef.current
    if (!c) return
    if (editorCam) {
      c.mouseButtons.LEFT = MOUSE.PAN
      c.mouseButtons.RIGHT = MOUSE.ROTATE
      c.mouseButtons.MIDDLE = MOUSE.DOLLY
    } else {
      c.mouseButtons.LEFT = MOUSE.ROTATE
      c.mouseButtons.MIDDLE = MOUSE.DOLLY
      c.mouseButtons.RIGHT = MOUSE.PAN
    }
  }, [editorCam])

  useLayoutEffect(() => {
    applyOrbitMouseButtons()
  }, [applyOrbitMouseButtons])

  useEffect(() => {
    const id = requestAnimationFrame(applyOrbitMouseButtons)
    return () => cancelAnimationFrame(id)
  }, [applyOrbitMouseButtons])

  return (
    <>
      <World
        terrainVoxels={terrainVoxels}
        portfolioEntries={portfolioEntries}
        draftExhibits={draftExhibits}
        selectedId={selectedId}
        onSelectEntry={onSelectEntry}
        buildMode={buildMode}
        terrainEraseHoverKey={
          dev && buildMode && editorTool === 'erase'
            ? terrainEraseHoverKey
            : null
        }
        draftEraseHoverId={
          dev && buildMode && editorTool === 'erase' ? draftEraseHoverId : null
        }
      />
      <Player
        positionRef={playerPositionRef}
        quaternionRef={playerQuaternionRef}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={editorCam}
        enableZoom={editorCam}
        enableRotate
        minPolarAngle={editorCam ? 0.06 : 0.35}
        maxPolarAngle={editorCam ? Math.PI - 0.06 : Math.PI / 2 - 0.08}
        minDistance={editorCam ? 2.5 : 12}
        maxDistance={editorCam ? 160 : 12}
        target={[spawn.x, spawn.y, spawn.z]}
      />
      <PlayerRoll
        playerPositionRef={playerPositionRef}
        playerQuaternionRef={playerQuaternionRef}
        controlsRef={controlsRef}
        keyQueue={keyQueue}
        jumpPendingRef={jumpPendingRef}
        buildMode={editorCam}
      />
      {dev && buildMode ? (
        <TerrainEditor
          enabled
          tool={editorTool}
          color={editorColor}
          placeKind={editorPlaceKind}
          brush={editorBrush}
          terrainVoxels={terrainVoxels}
          onTerrainChange={onTerrainChange}
          draftExhibits={draftExhibits}
          onDraftExhibitsChange={onDraftExhibitsChange}
          staticExhibitKeys={staticExhibitKeys}
          onEraseHover={onEraseHover}
        />
      ) : null}
      <ScenePostFX />
    </>
  )
}
