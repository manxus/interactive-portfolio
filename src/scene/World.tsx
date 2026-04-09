import { Environment } from '@react-three/drei'
import {
  defaultWorldLighting,
  type WorldLightingSettings,
} from '../data/worldLighting'
import type { PortfolioEntry } from '../data/portfolio'
import type { TerrainVoxel } from '../data/terrain'
import { Exhibit } from './Exhibit'
import { IlluminationBlock } from './IlluminationBlock'
import { TerrainBlock } from './TerrainBlock'
import { WORLD_HALF } from './collision'

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
  /** Scene lights / fog / background; defaults match original shipped look. */
  lighting?: WorldLightingSettings
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
  lighting: lightingProp,
}: WorldProps) {
  const L = lightingProp ?? defaultWorldLighting
  return (
    <>
      <color attach="background" args={[L.backgroundColor]} />
      <fog attach="fog" args={[L.fogColor, L.fogNear, L.fogFar]} />
      <Environment
        preset="city"
        environmentIntensity={L.environmentIntensity}
      />
      <ambientLight color={L.ambientColor} intensity={L.ambientIntensity} />
      <directionalLight
        position={[12, 20, 10]}
        color={L.directionalColor}
        intensity={L.directionalIntensity}
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
        const hi = terrainEraseHoverKey === k
        return voxel.kind === 'light' ? (
          <IlluminationBlock key={k} voxel={voxel} eraseHighlighted={hi} />
        ) : (
          <TerrainBlock key={k} voxel={voxel} eraseHighlighted={hi} />
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
