import { Vector3 } from 'three'
import {
  committedTerrainVoxels,
  portfolioEntries,
  type PortfolioEntry,
} from '../data/portfolio'
import type { TerrainVoxel } from '../data/terrain'

/**
 * World grid: one cell = 1 unit. Player, exhibits, and terrain voxels use integer (x, z) columns.
 */
export const CELL = 1

export const EXHIBIT_HALF = 0.5

/** Player cube is 1×1×1. */
export const PLAYER_HALF = 0.5

/** Fallback spawn height when no solid exists (player may fall until you add blocks). */
export const PLAYER_CENTER_Y = PLAYER_HALF

export const WORLD_HALF = 28

/** Max vertical rise (world units) for one auto-mantle onto a neighbor column. */
export const MAX_WALL_CLIMB_DELTA = 6

/** Y reference for tier math beside walls when the local column has no voxels (no invisible floor). */
const VOID_TIER_BASE = 0

const exhibitStatic: Vector3[] = portfolioEntries.map(
  (e) => new Vector3(e.position[0], e.position[1], e.position[2]),
)

let draftExhibitPart: Vector3[] = []

let terrainPart: Vector3[] = committedTerrainVoxels.map(
  (t) => new Vector3(t.position[0], t.position[1], t.position[2]),
)

/** All solid 1×1×1 voxel centers (portfolio + dev draft exhibits + terrain). */
export const solidVoxelCenters: Vector3[] = []

function rebuildSolidVoxelCenters(): void {
  solidVoxelCenters.length = 0
  for (const c of exhibitStatic) solidVoxelCenters.push(c)
  for (const c of draftExhibitPart) solidVoxelCenters.push(c)
  for (const c of terrainPart) solidVoxelCenters.push(c)
}

rebuildSolidVoxelCenters()

/** Sync terrain + dev draft exhibits. Portfolio entries are fixed at module load. */
export function setWorldCollision(
  terrain: TerrainVoxel[],
  draftExhibits: PortfolioEntry[],
): void {
  terrainPart = terrain.map(
    (t) => new Vector3(t.position[0], t.position[1], t.position[2]),
  )
  draftExhibitPart = draftExhibits.map(
    (e) => new Vector3(e.position[0], e.position[1], e.position[2]),
  )
  rebuildSolidVoxelCenters()
}

export function aabbOverlap3D(
  a: Vector3,
  halfA: number,
  b: Vector3,
  halfB: number,
): boolean {
  const e = halfA + halfB
  return (
    Math.abs(a.x - b.x) < e &&
    Math.abs(a.y - b.y) < e &&
    Math.abs(a.z - b.z) < e
  )
}

/**
 * Top surface Y of the highest solid in column (integer x, z).
 * Empty columns return {@link Number.NEGATIVE_INFINITY} — no invisible ground plane.
 */
export function getTerrainTopWorld(x: number, z: number): number {
  const ix = Math.round(x)
  const iz = Math.round(z)
  let top = Number.NEGATIVE_INFINITY
  for (const c of solidVoxelCenters) {
    if (Math.round(c.x) !== ix || Math.round(c.z) !== iz) continue
    const blockTop = c.y + EXHIBIT_HALF
    if (blockTop > top) top = blockTop
  }
  return top
}

const SUPPORT_FEET_TOL = 0.08
const CLIMB_GEOM_TOL = 0.08

/** True if some voxel in this column occupies world Y (inclusive of top/bottom faces). */
function columnIncludesWorldY(ix: number, iz: number, yWorld: number): boolean {
  const rx = Math.round(ix)
  const rz = Math.round(iz)
  for (const c of solidVoxelCenters) {
    if (Math.round(c.x) !== rx || Math.round(c.z) !== rz) continue
    const b = c.y - EXHIBIT_HALF
    const t = c.y + EXHIBIT_HALF
    if (yWorld >= b - 1e-3 && yWorld <= t + 1e-3) return true
  }
  return false
}

/** True if this column has a block top at `feetY` (next tier of a solid stack). */
function columnHasStandTopAtFeet(ix: number, iz: number, feetY: number): boolean {
  const rx = Math.round(ix)
  const rz = Math.round(iz)
  for (const c of solidVoxelCenters) {
    if (Math.round(c.x) !== rx || Math.round(c.z) !== rz) continue
    const blockTop = c.y + EXHIBIT_HALF
    if (Math.abs(blockTop - feetY) < CLIMB_GEOM_TOL) return true
  }
  return false
}

/**
 * Top Y of the highest solid in this column whose top is at or below the feet line.
 * Use for standing / gravity / input so a ceiling voxel above does not steal the “ground”
 * from a lower floor in the same (x,z) column.
 */
export function getSupportSurfaceWorld(
  x: number,
  z: number,
  feetY: number,
): number {
  const ix = Math.round(x)
  const iz = Math.round(z)
  let best = Number.NEGATIVE_INFINITY
  for (const c of solidVoxelCenters) {
    if (Math.round(c.x) !== ix || Math.round(c.z) !== iz) continue
    const blockTop = c.y + EXHIBIT_HALF
    if (blockTop <= feetY + SUPPORT_FEET_TOL && blockTop > best) best = blockTop
  }
  if (best === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY
  return best
}

/** True if player AABB intersects any exhibit volume. */
export function playerIntersectsExhibitVolume(playerCenter: Vector3): boolean {
  return playerIntersectsExhibitVolumeWithHalf(playerCenter, PLAYER_HALF)
}

/** Same as {@link playerIntersectsExhibitVolume} but with a custom half-extent (e.g. looser hinge clearance). */
export function playerIntersectsExhibitVolumeWithHalf(
  playerCenter: Vector3,
  playerHalf: number,
): boolean {
  for (const c of solidVoxelCenters) {
    if (aabbOverlap3D(playerCenter, playerHalf, c, EXHIBIT_HALF)) return true
  }
  return false
}

/** Min overlap on each axis to count as solid penetration (face contact / flush stacks = no). */
const SOLID_PENETRATION_MIN = 0.022

/**
 * True if the player’s box has positive-volume overlap with a voxel (not merely touching a face).
 * Used for standing checks so resting on a block top doesn’t false-positive against that block.
 *
 * When `standFeetY` is set (same column as player’s rounded x,z) and
 * `ignoreVoxelsSharingColumnAboveFeet` is true (default), voxels whose bottom is at or above the
 * feet line are ignored so a vertical stack in your cell doesn’t false-positive while you stand
 * on a lower tier.
 *
 * Set `ignoreVoxelsSharingColumnAboveFeet` to false for **ledge / beside-wall** poses: horizontal
 * arms of an “E” shape share your (x,z) but are not a straight stack; those voxels must still
 * block if they overlap the body (otherwise climbs ignore ceilings or need extra key presses).
 */
export function playerPenetratesSolidVoxels(
  playerCenter: Vector3,
  playerHalf: number = PLAYER_HALF,
  standFeetY?: number,
  ignoreVoxelsSharingColumnAboveFeet: boolean = true,
): boolean {
  const pxi = Math.round(playerCenter.x)
  const pzi = Math.round(playerCenter.z)

  for (const c of solidVoxelCenters) {
    const ix = Math.round(c.x)
    const iz = Math.round(c.z)
    const blockBottom = c.y - EXHIBIT_HALF
    if (
      ignoreVoxelsSharingColumnAboveFeet &&
      standFeetY !== undefined &&
      ix === pxi &&
      iz === pzi &&
      blockBottom >= standFeetY - 1e-3
    ) {
      continue
    }

    const ox = playerHalf + EXHIBIT_HALF - Math.abs(playerCenter.x - c.x)
    const oy = playerHalf + EXHIBIT_HALF - Math.abs(playerCenter.y - c.y)
    const oz = playerHalf + EXHIBIT_HALF - Math.abs(playerCenter.z - c.z)
    if (
      ox > SOLID_PENETRATION_MIN &&
      oy > SOLID_PENETRATION_MIN &&
      oz > SOLID_PENETRATION_MIN
    ) {
      return true
    }
  }
  return false
}

export function snapPlayerToGridXZ(p: Vector3): void {
  p.x = Math.round(p.x / CELL) * CELL
  p.z = Math.round(p.z / CELL) * CELL
}

/**
 * Feet rest on the column top and the body does not intersect solid voxels.
 */
export function canPlayerStandAt(center: Vector3): boolean {
  const p = center.clone()
  snapPlayerToGridXZ(p)
  const feet = p.y - PLAYER_HALF
  const topo = getSupportSurfaceWorld(p.x, p.z, feet)
  if (Math.abs(feet - topo) > 0.08) return false
  if (playerPenetratesSolidVoxels(p, PLAYER_HALF, feet)) return false
  const lim = WORLD_HALF - PLAYER_HALF
  return Math.abs(p.x) <= lim && Math.abs(p.z) <= lim
}

/** Horizontal roll / step to neighbor cell (toXZ should include correct surface Y). */
export function canRollLandAt(fromCenter: Vector3, toPos: Vector3): boolean {
  const dest = toPos.clone()
  snapPlayerToGridXZ(dest)
  const fromFeet = fromCenter.y - PLAYER_HALF
  const topo = getSupportSurfaceWorld(dest.x, dest.z, fromFeet)
  if (!Number.isFinite(topo)) return false
  // Do not roll “up” onto a taller column — that must use climb (one tier per input).
  if (topo > fromFeet + 1e-3) return false
  dest.y = topo + PLAYER_HALF
  return canPlayerStandAt(dest)
}

/** Cardinal offsets for finding a lower neighbor column (open side for seam). */
const NEIGHBOR_DXZ: readonly [number, number][] = [
  [CELL, 0],
  [-CELL, 0],
  [0, CELL],
  [0, -CELL],
]

/**
 * Horizontal unit toward a neighbor whose terrain top is at or below `feetY`
 * (open side along the wall for a seam hinge). Ground-level climbs need `t <= feetY`,
 * not strictly less, or no direction qualifies when feet are on y=0.
 */
export function pickOpenSideDirForClimb(
  ix: number,
  iz: number,
  feetY: number,
  out: Vector3,
): boolean {
  for (const [dx, dz] of NEIGHBOR_DXZ) {
    const t = getTerrainTopWorld(ix + dx, iz + dz)
    // Void neighbors count as open air beside a pillar.
    if (t === Number.NEGATIVE_INFINITY || t <= feetY + 1e-3) {
      const sx = Math.sign(dx)
      const sz = Math.sign(dz)
      out.set(sx === 0 ? 0 : sx, 0, sz === 0 ? 0 : sz)
      return true
    }
  }
  return false
}

const seamScratch = new Vector3()

/**
 * Resting on an air column beside a taller stack (mid-climb), not on local terrain top.
 * Used for gravity/input so one tier at a time does not fall or lose key handling.
 *
 * Uses {@link getSupportSurfaceWorld} under the feet line — not {@link getTerrainTopWorld},
 * which is the column apex. A block stacked above the player in the same (x,z) would make
 * the apex high and wrongly reject this shelf (negative tier delta → gravity wins).
 */
export function isAdjacentClimbRest(center: Vector3): boolean {
  const p = center.clone()
  snapPlayerToGridXZ(p)
  const ix = Math.round(p.x)
  const iz = Math.round(p.z)
  const feet = p.y - PLAYER_HALF
  const localSupport = getSupportSurfaceWorld(ix, iz, feet)
  if (Number.isFinite(localSupport) && Math.abs(feet - localSupport) < 0.08) return false
  // Void column: no voxel under feet — tier height is still measured from world y=0 for ledge logic only.
  const supportForTier =
    localSupport === Number.NEGATIVE_INFINITY ? VOID_TIER_BASE : localSupport
  const tierDelta = feet - supportForTier
  // Falling past a wall (non–tier height) must not count as climb rest or gravity/input stall.
  if (tierDelta < 1 - 0.08) return false
  if (Math.abs(tierDelta - Math.round(tierDelta)) > 0.12) return false
  if (!pickOpenSideDirForClimb(ix, iz, feet, seamScratch)) return false
  // Strict penetration: same-column “stack” skip would miss E-shaped overhangs in this cell.
  if (playerPenetratesSolidVoxels(p, PLAYER_HALF, feet, false)) return false
  const lim = WORLD_HALF - PLAYER_HALF
  if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) return false
  for (const [dx, dz] of NEIGHBOR_DXZ) {
    const nx = ix + dx
    const nz = iz + dz
    const nt = getTerrainTopWorld(nx, nz)
    if (nt <= feet + 1e-3) continue
    if (columnIncludesWorldY(nx, nz, feet)) return true
  }
  return false
}

/** Valid mid-climb pose: same cell as player, one tier up the wall face, wall still taller. */
function canClimbRestBesideWall(
  center: Vector3,
  wallCellX: number,
  wallCellZ: number,
): boolean {
  const p = center.clone()
  snapPlayerToGridXZ(p)
  const ix = Math.round(p.x)
  const iz = Math.round(p.z)
  const feet = p.y - PLAYER_HALF
  const wallTop = getTerrainTopWorld(wallCellX, wallCellZ)
  if (wallTop === Number.NEGATIVE_INFINITY || wallTop <= feet + 1e-3) return false
  if (!columnIncludesWorldY(wallCellX, wallCellZ, feet)) return false
  if (!pickOpenSideDirForClimb(ix, iz, feet, seamScratch)) return false
  if (playerPenetratesSolidVoxels(p, PLAYER_HALF, feet, false)) return false
  const lim = WORLD_HALF - PLAYER_HALF
  return Math.abs(p.x) <= lim && Math.abs(p.z) <= lim
}

/**
 * One mantle step toward the neighbor stack in `dir`: feet rise by exactly one world unit.
 * Rest poses stay in the player’s air cell beside the pillar; only the summit step uses the
 * neighbor’s (x,z) so the cube isn’t centered inside a multi-block column mid-climb.
 */
export function getClimbTargetIfValid(
  center: Vector3,
  dir: Vector3,
  out: Vector3,
): boolean {
  const ix = Math.round(center.x / CELL) * CELL
  const iz = Math.round(center.z / CELL) * CELL
  const feet = center.y - PLAYER_HALF
  const nx = ix + dir.x * CELL
  const nz = iz + dir.z * CELL
  const topoN = getTerrainTopWorld(nx, nz)
  const rise = topoN - feet
  if (rise < 1 - 1e-3) return false
  if (rise > MAX_WALL_CLIMB_DELTA + 1e-3) return false
  const nextFeet = feet + 1
  if (nextFeet > topoN + 1e-3) return false

  if (columnHasStandTopAtFeet(nx, nz, nextFeet)) {
    // Same (nx,nz) as the stack shares the pillar’s 1×1 footprint — mid-climb that embeds the
    // cube in voxels above the feet. Stay in the air cell (ix,iz) until the top tier.
    if (nextFeet < topoN - 1e-3) {
      out.set(ix, nextFeet + PLAYER_HALF, iz)
      return canClimbRestBesideWall(out, nx, nz)
    }
    out.set(nx, nextFeet + PLAYER_HALF, nz)
    return canPlayerStandAt(out)
  }

  // Taller face with no stand at feet+1 on the neighbor (e.g. gap / non-unit stack).
  if (nextFeet < topoN - 1e-3) {
    out.set(ix, nextFeet + PLAYER_HALF, iz)
    return canClimbRestBesideWall(out, nx, nz)
  }

  out.set(nx, topoN + PLAYER_HALF, nz)
  return canPlayerStandAt(out)
}

/**
 * One mantle step straight up on your current column (stack), if more blocks above.
 * `seamDirOut` faces toward open air for world-grid seam pivot (same rules as lateral climb).
 */
export function getClimbUpOneStepIfValid(
  center: Vector3,
  out: Vector3,
  seamDirOut: Vector3,
): boolean {
  const ix = Math.round(center.x / CELL) * CELL
  const iz = Math.round(center.z / CELL) * CELL
  const feet = center.y - PLAYER_HALF
  const topo = getTerrainTopWorld(ix, iz)
  if (topo - feet < 1 - 1e-3) return false
  if (topo - feet > MAX_WALL_CLIMB_DELTA + 1e-3) return false
  if (!pickOpenSideDirForClimb(ix, iz, feet, seamDirOut)) return false
  const nextFeet = feet + 1
  if (!columnHasStandTopAtFeet(ix, iz, nextFeet)) return false
  out.set(ix, nextFeet + PLAYER_HALF, iz)
  return canPlayerStandAt(out)
}

/** @deprecated use canPlayerStandAt — kept for spawn search on ground tier */
export function canPlayerOccupy(centerXZ: Vector3): boolean {
  const topo = getTerrainTopWorld(centerXZ.x, centerXZ.z)
  const y = topo + PLAYER_HALF
  return canPlayerStandAt(new Vector3(centerXZ.x, y, centerXZ.z))
}

export function findSpawnCenter(): Vector3 {
  const maxSteps = 36
  const tryCell = (x: number, z: number) => {
    const topo = getTerrainTopWorld(x, z)
    if (topo === Number.NEGATIVE_INFINITY) return null
    const y = topo + PLAYER_HALF
    const p = new Vector3(x, y, z)
    if (canPlayerStandAt(p)) return p.clone()
    return null
  }
  const o = tryCell(0, 0)
  if (o) return o
  for (let r = 1; r <= maxSteps; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dz of [-r, r]) {
        const x = dx * CELL
        const z = dz * CELL
        const p = tryCell(x, z)
        if (p) return p
      }
    }
    for (let dz = -r + 1; dz <= r - 1; dz++) {
      for (const dx of [-r, r]) {
        const x = dx * CELL
        const z = dz * CELL
        const p = tryCell(x, z)
        if (p) return p
      }
    }
  }
  for (const e of portfolioEntries) {
    const p = tryCell(e.position[0], e.position[2])
    if (p) return p
  }
  return new Vector3(0, PLAYER_CENTER_Y, 0)
}
