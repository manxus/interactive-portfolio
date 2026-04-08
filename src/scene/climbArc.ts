import { CubicBezierCurve3, Quaternion, Vector3 } from 'three'
import {
  CELL,
  EXHIBIT_HALF,
  getTerrainTopWorld,
  PLAYER_HALF,
  playerIntersectsExhibitVolume,
  playerIntersectsExhibitVolumeWithHalf,
} from './collision'

const WORLD_UP = new Vector3(0, 1, 0)

/** True when start/end share the same grid cell on XZ (shelf climb beside a wall). */
export function climbSameCellXZ(from: Vector3, to: Vector3): boolean {
  const fx = Math.round(from.x / CELL) * CELL
  const fz = Math.round(from.z / CELL) * CELL
  const tx = Math.round(to.x / CELL) * CELL
  const tz = Math.round(to.z / CELL) * CELL
  return fx === tx && fz === tz
}

/**
 * Hinge arcs can pull the center through the wall plane. Keep the 1×1 player outside the
 * neighbor wall column on XZ (unchanged Y) for same-cell face climbs.
 */
export function clampBesideWallHingePos(
  pos: Vector3,
  from: Vector3,
  climbDir: Vector3,
): void {
  const ix = Math.round(from.x / CELL) * CELL
  const iz = Math.round(from.z / CELL) * CELL
  const gap = EXHIBIT_HALF + PLAYER_HALF
  if (Math.abs(climbDir.x) > 0.5) {
    const wallCx = ix + climbDir.x * CELL
    if (climbDir.x < 0) pos.x = Math.max(pos.x, wallCx + gap)
    else pos.x = Math.min(pos.x, wallCx - gap)
  }
  if (Math.abs(climbDir.z) > 0.5) {
    const wallCz = iz + climbDir.z * CELL
    if (climbDir.z < 0) pos.z = Math.max(pos.z, wallCz + gap)
    else pos.z = Math.min(pos.z, wallCz - gap)
  }
}

/** Tight match so we don’t hinge when the arc misses `to` (avoids end snaps + wrong rest). */
const HINGE_END_MATCH_SQ = 0.065 * 0.065

const HALF_PI = Math.PI * 0.5

/** Nearest k·π/2 (clamped) so rest orientation matches voxel quarter-turn rolls. */
function snapQuarterTurn(angle: number): number {
  const k = Math.round(angle / HALF_PI)
  const kClamped = Math.max(-2, Math.min(2, k))
  return kClamped * HALF_PI
}

const hingeScratch = new Vector3()
const hingeCross = new Vector3()

/**
 * Corner of the top outer edge on the face toward `dir` (hinge runs along the seam through it).
 * Matches “pivot on the top corner touching the wall”, not the bottom edge of a ground roll.
 */
export function getWorldGridTopSeamPivotWorld(
  from: Vector3,
  dir: Vector3,
  out: Vector3,
): void {
  const hx = PLAYER_HALF
  const topY = from.y + hx
  const seam = new Vector3()
  getSeamAxisWorld(dir, seam)
  if (dir.x !== 0) {
    const sx = dir.x > 0 ? 1 : -1
    out.set(from.x + sx * hx, topY, from.z).addScaledVector(seam, hx)
  } else {
    const sz = dir.z > 0 ? 1 : -1
    out.set(from.x, topY, from.z + sz * hx).addScaledVector(seam, hx)
  }
}

/** Horizontal unit along the shared top seam (perpendicular to climb dir on XZ). */
export function getSeamAxisWorld(dir: Vector3, out: Vector3): void {
  const flat = new Vector3(dir.x, 0, dir.z)
  if (flat.lengthSq() < 1e-8) flat.set(1, 0, 0)
  else flat.normalize()
  out.copy(WORLD_UP).cross(flat)
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1)
  out.normalize()
}

/** Mantle only: ease-out so it doesn’t hang weightless like smoothstep at the ends. */
function climbMantleEase(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) * (1 - x)
}

/** Hinge climb: linear phase = constant spin rate (matches a physical roll, not a floaty tween). */
function climbHingeEase(t: number): number {
  return Math.min(1, Math.max(0, t))
}

/**
 * World orientation after the full climb motion (rigid hinge / mantle seam spin), matching `eval*` at t=1.
 */
export function climbEndQuaternion(
  path: ClimbPath,
  from: Vector3,
  to: Vector3,
  climbDir: Vector3,
  q0: Quaternion,
  qPart: Quaternion,
  pivotScratch: Vector3,
  axisScratch: Vector3,
  out: Quaternion,
): void {
  if (path.kind === 'hinge') {
    qPart.setFromAxisAngle(path.axis, path.angle)
    out.multiplyQuaternions(qPart, q0)
  } else {
    getWorldGridTopSeamPivotWorld(from, climbDir, pivotScratch)
    getSeamAxisWorld(climbDir, axisScratch)
    const ang = computeTopSeamHingeAngle(from, to, pivotScratch, axisScratch)
    qPart.setFromAxisAngle(axisScratch, ang)
    out.multiplyQuaternions(qPart, q0)
  }
}

const MANTLE_SAMPLES = 48

/** True when `to` is the next cell over on XZ (cardinal mantle onto neighbor). */
function isOntoNeighborClimb(from: Vector3, to: Vector3): boolean {
  const dx = Math.abs(to.x - from.x)
  const dz = Math.abs(to.z - from.z)
  return (
    (dx > 0.2 && dx < 1.05 && dz < 0.15) || (dz > 0.2 && dz < 1.05 && dx < 0.15)
  )
}

/**
 * Rise mostly in the approach cell, then step onto the neighbor — avoids diagonal cuts
 * through a tall stack when hinge is blocked and the classic mantle misses clearance.
 */
function buildUpFirstMantle(
  from: Vector3,
  to: Vector3,
  dir: Vector3,
  perpBase: Vector3,
  variant: number,
): CubicBezierCurve3 {
  const rise = Math.max(0.35, to.y - from.y)
  const boost =
    variant >= 48 ? Math.min((variant - 47) * 0.022, 0.42) : 0
  const v = variant % 48
  const upPhase = 0.36 + (v % 7) * 0.045
  const pullBack = 0.2 + (v % 6) * 0.035 + boost
  const side = ((v >> 2) % 3) * 0.055
  const sign = v % 2 === 0 ? 1 : -1
  const p0 = from.clone()
  const p1 = from.clone().addScaledVector(WORLD_UP, rise * upPhase)
  const p3 = to.clone()
  const p2 = to
    .clone()
    .addScaledVector(dir, -pullBack)
    .addScaledVector(perpBase, sign * side)
    .addScaledVector(WORLD_UP, 0.06 + (v >> 4) * 0.04 + boost * 0.15)
  return new CubicBezierCurve3(p0, p1, p2, p3)
}

function mantlePathIsClear(curve: CubicBezierCurve3): boolean {
  const p = new Vector3()
  for (let i = 0; i <= MANTLE_SAMPLES; i++) {
    curve.getPoint(i / MANTLE_SAMPLES, p)
    if (playerIntersectsExhibitVolume(p)) return false
  }
  return true
}

/**
 * Signed rotation angle (about `axis`) taking `from - pivot` toward `to - pivot` in their shared plane.
 * Expects `axis` unit; `from`/`to` are world centers, `pivot` on the top seam.
 */
export function computeTopSeamHingeAngle(
  from: Vector3,
  to: Vector3,
  pivot: Vector3,
  axis: Vector3,
): number {
  hingeScratch.subVectors(from, pivot)
  const v0 = hingeScratch
  const v1 = hingeCross.subVectors(to, pivot)
  const a = axis
  const len0 = v0.length()
  const len1 = v1.length()
  if (len0 < 1e-8 || len1 < 1e-8) return Math.PI
  const c = v0.dot(v1) / (len0 * len1)
  const s = a.dot(hingeCross.crossVectors(v0, v1)) / (len0 * len1)
  return Math.atan2(s, c)
}

const HINGE_SAMPLES = 80

export function hingeClimbPathIsClear(
  pivot: Vector3,
  vFromPivot: Vector3,
  axis: Vector3,
  totalAngle: number,
  playerHalf: number = PLAYER_HALF,
): boolean {
  const p = new Vector3()
  const off = new Vector3()
  for (let i = 0; i <= HINGE_SAMPLES; i++) {
    const t = i / HINGE_SAMPLES
    off.copy(vFromPivot).applyAxisAngle(axis, t * totalAngle)
    p.copy(pivot).add(off)
    if (playerIntersectsExhibitVolumeWithHalf(p, playerHalf)) return false
  }
  return true
}

export type ClimbPath =
  | { kind: 'hinge'; pivot: Vector3; axis: Vector3; v0: Vector3; angle: number }
  | { kind: 'mantle'; curve: CubicBezierCurve3 }

/**
 * Prefer a rigid seam roll when the climb target lies on the hinge arc (all valid one-tier
 * grid climbs). The old ‖v0‖≈‖v1‖ check wrongly sent “step onto neighbor column” moves to
 * the mantle Bezier, which felt like snaps/spin on tall stacks.
 */
export function createClimbPath(
  from: Vector3,
  to: Vector3,
  dir: Vector3,
): ClimbPath {
  const pivot = new Vector3()
  getWorldGridTopSeamPivotWorld(from, dir, pivot)
  const axis = new Vector3()
  getSeamAxisWorld(dir, axis)

  const v0 = new Vector3().subVectors(from, pivot)
  const angleRaw = computeTopSeamHingeAngle(from, to, pivot, axis)

  if (Math.abs(angleRaw) <= 1e-4) {
    return { kind: 'mantle', curve: createWallMantleCurve(from, to, dir) }
  }

  const snapped = snapQuarterTurn(angleRaw)
  hingeScratch.copy(v0).applyAxisAngle(axis, snapped)
  hingeCross.copy(pivot).add(hingeScratch)
  const endSnapSq = hingeCross.distanceToSquared(to)

  hingeScratch.copy(v0).applyAxisAngle(axis, angleRaw)
  hingeCross.copy(pivot).add(hingeScratch)
  const endRawSq = hingeCross.distanceToSquared(to)

  let chosenAngle: number
  if (endSnapSq <= HINGE_END_MATCH_SQ) {
    chosenAngle = snapped
  } else if (endRawSq <= HINGE_END_MATCH_SQ) {
    chosenAngle = angleRaw
  } else {
    return { kind: 'mantle', curve: createWallMantleCurve(from, to, dir) }
  }

  if (!hingeClimbPathIsClear(pivot, v0, axis, chosenAngle, PLAYER_HALF)) {
    return { kind: 'mantle', curve: createWallMantleCurve(from, to, dir) }
  }

  return {
    kind: 'hinge',
    pivot: pivot.clone(),
    axis: axis.clone(),
    v0: v0.clone(),
    angle: chosenAngle,
  }
}

export function evalHingeClimbFrame(
  pivot: Vector3,
  v0: Vector3,
  axis: Vector3,
  totalAngle: number,
  tLinear: number,
  posOut: Vector3,
  quatOut: Quaternion,
  q0: Quaternion,
  qPart: Quaternion,
  offsetScratch: Vector3,
): void {
  const te = climbHingeEase(tLinear)
  const ang = te * totalAngle
  offsetScratch.copy(v0).applyAxisAngle(axis, ang)
  posOut.copy(pivot).add(offsetScratch)
  qPart.setFromAxisAngle(axis, ang)
  quatOut.multiplyQuaternions(qPart, q0)
}

/**
 * Mantle path: starts tangent to a rotation about the top seam, bulges outward,
 * peaks above the lip, then settles on `to`. Used when a rigid hinge cannot reach `to`
 * (tall rise) or would intersect geometry along the arc.
 */
export function createWallMantleCurve(
  from: Vector3,
  to: Vector3,
  dir: Vector3,
): CubicBezierCurve3 {
  const pivot = new Vector3()
  getWorldGridTopSeamPivotWorld(from, dir, pivot)

  const vFrom = new Vector3().subVectors(from, pivot)
  const seamAxis = new Vector3()
  getSeamAxisWorld(dir, seamAxis)

  const tStart = new Vector3().copy(seamAxis).cross(vFrom)
  if (tStart.lengthSq() < 1e-8) {
    tStart.copy(vFrom).cross(seamAxis)
  }
  if (tStart.lengthSq() < 1e-8) {
    tStart.set(0, 1, 0)
  }
  tStart.normalize()

  const perpBase = new Vector3(-dir.z, 0, dir.x)
  if (perpBase.lengthSq() < 1e-8) perpBase.set(0, 0, 1)
  perpBase.normalize()

  const dy = Math.max(0.55, to.y - from.y)
  // Stronger outward bulge on single-step climbs so the path stays outside the pillar face.
  const outBase = dy < 1.15 ? 0.48 : 0.28 + dy * 0.16
  const hingePull = 0.38 + dy * 0.07
  const upKick = 0.12 + dy * 0.06

  const toFeet = to.y - PLAYER_HALF
  const wallIx = Math.round(to.x)
  const wallIz = Math.round(to.z)
  const wallTop = getTerrainTopWorld(wallIx, wallIz)
  const tallStackOntoNeighbor =
    isOntoNeighborClimb(from, to) && wallTop > toFeet + 0.22

  if (tallStackOntoNeighbor) {
    for (let v = 0; v < 80; v++) {
      const c = buildUpFirstMantle(from, to, dir, perpBase, v)
      if (mantlePathIsClear(c)) return c
    }
  }

  for (const sign of [1, -1] as const) {
    const perp = perpBase.clone().multiplyScalar(sign)
    for (let s = 1; s <= 8; s++) {
      const scale = 0.82 + s * 0.065
      const OUT = outBase * scale

      const p0 = from.clone()
      const p3 = to.clone()

      const p1 = new Vector3()
        .copy(from)
        .addScaledVector(tStart, hingePull)
        .addScaledVector(perp, OUT)
        .addScaledVector(WORLD_UP, upKick)

      const peakY = Math.max(from.y, to.y) + 0.38 + dy * 0.22
      const p2 = new Vector3()
        .copy(to)
        .addScaledVector(dir, -0.14)
        .addScaledVector(perp, OUT * 0.28)
        .setY(peakY)

      const curve = new CubicBezierCurve3(p0, p1, p2, p3)
      if (mantlePathIsClear(curve)) return curve
    }
  }

  if (tallStackOntoNeighbor) {
    return buildUpFirstMantle(from, to, dir, perpBase, 79)
  }

  const OUT = (dy < 1.15 ? 0.58 : 0.34 + dy * 0.2) * 1.35
  const perp = perpBase.clone()
  const p1 = new Vector3()
    .copy(from)
    .addScaledVector(tStart, hingePull * 1.08)
    .addScaledVector(perp, OUT)
    .addScaledVector(WORLD_UP, upKick * 1.05)
  const p2 = new Vector3()
    .copy(to)
    .addScaledVector(dir, -0.18)
    .addScaledVector(perp, OUT * 0.32)
    .setY(Math.max(from.y, to.y) + 0.52 + dy * 0.28)
  return new CubicBezierCurve3(from.clone(), p1, p2, to.clone())
}

export function evalMantleFrame(
  curve: CubicBezierCurve3,
  tLinear: number,
  posOut: Vector3,
): void {
  const te = climbMantleEase(tLinear)
  curve.getPoint(te, posOut)
}

/**
 * Same seam-axis spin as the hinge climb (roll up the wall), while position follows the mantle curve.
 */
export function evalMantleSeamRollRotation(
  from: Vector3,
  to: Vector3,
  climbDir: Vector3,
  q0: Quaternion,
  tLinear: number,
  quatOut: Quaternion,
  qPart: Quaternion,
  pivotScratch: Vector3,
  axisScratch: Vector3,
): void {
  getWorldGridTopSeamPivotWorld(from, climbDir, pivotScratch)
  getSeamAxisWorld(climbDir, axisScratch)
  const angle = computeTopSeamHingeAngle(from, to, pivotScratch, axisScratch)
  // Match wall-clock climb progress (position still eases via climbMantleEase in evalMantleFrame).
  qPart.setFromAxisAngle(axisScratch, tLinear * angle)
  quatOut.multiplyQuaternions(qPart, q0)
}
