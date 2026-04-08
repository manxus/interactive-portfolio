import type { TerrainVoxel } from './terrain'
import levelTerrainJson from './level.terrain.json'

export type PortfolioLink = {
  label: string
  href: string
}

export type PortfolioEntry = {
  id: string
  title: string
  summary: string
  tags: string[]
  links: PortfolioLink[]
  /**
   * World center of the 1×1×1 exhibit. Use integer x and z (grid cells).
   * Voxel centers use half-integers on y (e.g. …, -0.5, 0.5, 1.5, …) at the same x,z.
   */
  position: [number, number, number]
  color: string
}

type LevelTerrainFile = {
  voxels: TerrainVoxel[]
}

/** Authored environment; replace via dev Build menu export and commit for production. */
export const committedTerrainVoxels: TerrainVoxel[] = (
  levelTerrainJson as LevelTerrainFile
).voxels

/**
 * Projects shown in the world. Empty by default — add entries here or place “project” blocks in dev build mode.
 */
export const portfolioEntries: PortfolioEntry[] = []

export function exhibitOccupiedCenterKeys(): Set<string> {
  return new Set(
    portfolioEntries.map(
      (e) => `${e.position[0]},${e.position[1]},${e.position[2]}`,
    ),
  )
}
