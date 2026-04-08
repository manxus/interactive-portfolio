import { Quaternion, Vector3 } from 'three'
import { CELL, getSupportSurfaceWorld, PLAYER_HALF } from './collision'

const UP = new Vector3(0, 1, 0)

export function cardinalDirFromKey(
  camera: { getWorldDirection: (t: Vector3) => Vector3 },
  key: 'w' | 'a' | 's' | 'd',
): Vector3 {
  const forward = new Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1)
  else forward.normalize()

  const right = new Vector3().crossVectors(forward, UP).normalize()

  const flat = new Vector3()
  if (key === 'w') flat.copy(forward)
  else if (key === 's') flat.copy(forward).negate()
  else if (key === 'a') flat.copy(right).negate()
  else flat.copy(right)

  if (Math.abs(flat.x) >= Math.abs(flat.z)) {
    const sx = Math.sign(flat.x)
    return new Vector3(sx === 0 ? 1 : sx, 0, 0)
  }
  const sz = Math.sign(flat.z)
  return new Vector3(0, 0, sz === 0 ? -1 : sz)
}

export function rollPivot(center: Vector3, dir: Vector3, out: Vector3): void {
  const footY = center.y - PLAYER_HALF
  out.set(
    center.x + dir.x * PLAYER_HALF,
    footY,
    center.z + dir.z * PLAYER_HALF,
  )
}

export function rollAxis(dir: Vector3, out: Vector3): void {
  out.copy(UP).cross(dir).normalize()
}

/**
 * Neighbor cell center; Y lands on the highest surface in that column at or below the
 * player’s feet (ignores floating blocks above), so rolls don’t treat air gaps as solid walls.
 */
export function rollEndCenter(center: Vector3, dir: Vector3, out: Vector3): void {
  const nx = Math.round(center.x / CELL) * CELL + dir.x * CELL
  const nz = Math.round(center.z / CELL) * CELL + dir.z * CELL
  const fromFeet = center.y - PLAYER_HALF
  const sup = getSupportSurfaceWorld(nx, nz, fromFeet)
  const ty = Number.isFinite(sup) ? sup + PLAYER_HALF : center.y
  out.set(nx, ty, nz)
}

export function quaternionAfterRoll(
  axis: Vector3,
  q0: Quaternion,
  out: Quaternion,
): void {
  const dq = new Quaternion().setFromAxisAngle(axis, Math.PI / 2)
  out.multiplyQuaternions(dq, q0)
}
