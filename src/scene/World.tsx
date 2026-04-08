import { Environment } from '@react-three/drei'
import type { PortfolioEntry } from '../data/portfolio'
import type { TerrainVoxel } from '../data/terrain'
import { Exhibit } from './Exhibit'
import { TerrainBlock } from './TerrainBlock'
import { WORLD_HALF } from './collision'

const BG = '#0c0e12'

type WorldProps = {
  terrainVoxels: TerrainVoxel[]
  portfolioEntries: PortfolioEntry[]
  draftExhibits: PortfolioEntry[]
  selectedId: string | null
  onSelectEntry: (id: string) => void
  /** When true, exhibit clicks do not open the detail panel (build tools use the ray). */
  buildMode?: boolean
  /** Voxel key `x,y,z` for erase-tool hover highlight in dev editor. */
  terrainEraseHoverKey?: string | null
  draftEraseHoverId?: string | null
}

export function World({
  terrainVoxels,
  portfolioEntries,
  draftExhibits,
  selectedId,
  onSelectEntry,
  buildMode = false,
  terrainEraseHoverKey,
  draftEraseHoverId,
}: WorldProps) {
  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 34, 72]} />
      <Environment preset="city" environmentIntensity={0.22} />
      <ambientLight intensity={0.48} />
      <directionalLight
        position={[12, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={56}
        shadow-camera-left={-WORLD_HALF}
        shadow-camera-right={WORLD_HALF}
        shadow-camera-top={WORLD_HALF}
        shadow-camera-bottom={-WORLD_HALF}
        shadow-bias={-0.00045}
        shadow-normalBias={0.045}
      />
      {terrainVoxels.map((voxel) => {
        const k = `${voxel.position[0]},${voxel.position[1]},${voxel.position[2]}`
        return (
          <TerrainBlock
            key={k}
            voxel={voxel}
            eraseHighlighted={terrainEraseHoverKey === k}
          />
        )
      })}
      {portfolioEntries.map((entry) => (
        <Exhibit
          key={entry.id}
          entry={entry}
          highlighted={selectedId === entry.id}
          onSelect={onSelectEntry}
          suppressSelection={buildMode}
        />
      ))}
      {draftExhibits.map((entry) => (
        <Exhibit
          key={entry.id}
          entry={entry}
          highlighted={selectedId === entry.id}
          onSelect={onSelectEntry}
          draftExhibitId={entry.id}
          eraseHighlighted={draftEraseHoverId === entry.id}
          suppressSelection={buildMode}
        />
      ))}
    </>
  )
}
