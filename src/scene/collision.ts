import { Vector3 } from 'three'
import { portfolioEntries } from '../data/portfolio'

/**
 * World grid: one cell = 1 unit. Player and exhibits use centers on integer (x, z).
 */
export const CELL = 1

export const EXHIBIT_HALF = 0.5

/** Player cube is 1×1×1. */
export const PLAYER_HALF = 0.5

/** Default ground stand (feet on y=0). */
export const PLAYER_CENTER_Y = PLAYER_HALF

export const WORLD_HALF = 22

/** Max vertical rise (world units) for one auto-mantle onto a neighbor column. */
export const MAX_WALL_CLIMB_DELTA = 6

export const exhibitCenters: Vector3[] = portfolioEntries.map(
  (e) => new Vector3(e.position[0], e.position[1], e.position[2]),
)

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

/** Top surface Y of the highest solid in column (integer x, z). Ground with no block = 0. */
export function getTerrainTopWorld(x: number, z: number): number {
  const ix = Math.round(x)
  const iz = Math.round(z)
  let top = 0
  for (const c of exhibitCenters) {
    if (Math.round(c.x) !== ix || Math.round(c.z) !== iz) continue
    const blockTop = c.y + EXHIBIT_HALF
    if (blockTop > top) top = blockTop
  }
  return top
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
  for (const c of exhibitCenters) {
    if (aabbOverlap3D(playerCenter, playerHalf, c, EXHIBIT_HALF)) return true
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
  const topo = getTerrainTopWorld(p.x, p.z)
  if (Math.abs(feet - topo) > 0.08) return false
  if (playerIntersectsExhibitVolume(p)) return false
  const lim = WORLD_HALF - PLAYER_HALF
  return Math.abs(p.x) <= lim && Math.abs(p.z) <= lim
}

/** Horizontal roll / step to neighbor cell (toXZ should include correct surface Y). */
export function canRollLandAt(fromCenter: Vector3, toPos: Vector3): boolean {
  const dest = toPos.clone()
  snapPlayerToGridXZ(dest)
  const fromFeet = fromCenter.y - PLAYER_HALF
  const topo = getTerrainTopWorld(dest.x, dest.z)
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
    if (t <= feetY + 1e-3) {
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
 */
export function isAdjacentClimbRest(center: Vector3): boolean {
  const p = center.clone()
  snapPlayerToGridXZ(p)
  const ix = Math.round(p.x)
  const iz = Math.round(p.z)
  const feet = p.y - PLAYER_HALF
  const localTopo = getTerrainTopWorld(ix, iz)
  if (Math.abs(feet - localTopo) < 0.08) return false
  const tierDelta = feet - localTopo
  // Falling past a wall (non–tier height) must not count as climb rest or gravity/input stall.
  if (tierDelta < 1 - 0.08) return false
  if (Math.abs(tierDelta - Math.round(tierDelta)) > 0.12) return false
  if (!pickOpenSideDirForClimb(ix, iz, feet, seamScratch)) return false
  if (playerIntersectsExhibitVolume(p)) return false
  const lim = WORLD_HALF - PLAYER_HALF
  if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) return false
  for (const [dx, dz] of NEIGHBOR_DXZ) {
    const nt = getTerrainTopWorld(ix + dx, iz + dz)
    if (nt > feet + 1e-3) return true
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
  if (wallTop <= feet + 1e-3) return false
  if (!pickOpenSideDirForClimb(ix, iz, feet, seamScratch)) return false
  if (playerIntersectsExhibitVolume(p)) return false
  const lim = WORLD_HALF - PLAYER_HALF
  return Math.abs(p.x) <= lim && Math.abs(p.z) <= lim
}

/**
 * One mantle step onto the neighbor cell in `dir`: feet rise by exactly 1 world unit
 * toward that column’s surface (like one ground roll). Repeat to reach the top.
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
  // Solid stacks fill the whole column: only the top is a valid stand inside (nx,nz).
  // Intermediate tiers stay in the open cell beside the wall (same ix, iz as player).
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
  const maxSteps = 28
  const tryCell = (x: number, z: number) => {
    const topo = getTerrainTopWorld(x, z)
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
  return new Vector3(0, PLAYER_CENTER_Y, 0)
}
