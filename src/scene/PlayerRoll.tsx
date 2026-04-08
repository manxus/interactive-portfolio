import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { MutableRefObject, RefObject } from 'react'
import {
  canRollLandAt,
  getClimbTargetIfValid,
  getClimbUpOneStepIfValid,
  getSupportSurfaceWorld,
  getTerrainTopWorld,
  isAdjacentClimbRest,
  PLAYER_HALF,
  snapPlayerToGridXZ,
} from './collision'
import {
  cardinalDirFromKey,
  quaternionAfterRoll,
  rollAxis,
  rollEndCenter,
  rollPivot,
} from './rollMath'
import type { RollKey } from './useRollKeyQueue'
import {
  clampBesideWallHingePos,
  climbEndQuaternion,
  climbSameCellXZ,
  createClimbPath,
  evalHingeClimbFrame,
  evalMantleFrame,
  evalMantleSeamRollRotation,
  type ClimbPath,
} from './climbArc'

const ROLL_SECONDS = 0.32
const CLIMB_BASE_SECONDS = 0.44
/** Mantle is a clearance path only; keep it shorter so it doesn’t feel floaty vs hinge rolls. */
const CLIMB_MANTLE_EXTRA = 0.1
const GRAVITY = 42
const JUMP_VELOCITY = 10
/** Cap RAF delta so one hitch (tab blur, breakpoint, stutter) cannot skip a whole climb/roll. */
const MAX_FRAME_DELTA = 0.05

type RollingState = {
  u: number
  pivot: Vector3
  axis: Vector3
  v0: Vector3
  q0: Quaternion
  q1: Quaternion
  endPos: Vector3
  /**
   * Neighbor ground is below our feet: finish the full edge pivot arc, then let gravity
   * take over (do not snap to endPos on the last frame — that would skip the drop).
   */
  freeFallAfterRoll: boolean
}

type ClimbingState = {
  u: number
  duration: number
  path: ClimbPath
  from: Vector3
  climbDir: Vector3
  to: Vector3
  q0: Quaternion
  /** Same idea as ground roll `q1`: rigid end orientation, no extra slerp-to-identity spin. */
  q1: Quaternion
}

type PlayerRollProps = {
  playerPositionRef: MutableRefObject<Vector3>
  playerQuaternionRef: MutableRefObject<Quaternion>
  controlsRef: RefObject<OrbitControlsImpl | null>
  keyQueue: MutableRefObject<RollKey[]>
  jumpPendingRef: MutableRefObject<boolean>
  /** When true, skip movement/gravity so the free camera can drive the view. */
  buildMode?: boolean
}

export function PlayerRoll({
  playerPositionRef,
  playerQuaternionRef,
  controlsRef,
  keyQueue,
  jumpPendingRef,
  buildMode = false,
}: PlayerRollProps) {
  const { camera } = useThree()
  const rollingRef = useRef<RollingState | null>(null)
  const climbingRef = useRef<ClimbingState | null>(null)
  const vyRef = useRef(0)
  /** After roll-off ledge: bypass climb-rest “shelf” so gravity runs until real ground. */
  const edgeDropPendingRef = useRef(false)

  const pivotScratch = useRef(new Vector3())
  const axisScratch = useRef(new Vector3())
  const endScratch = useRef(new Vector3())
  const climbTargetScratch = useRef(new Vector3())
  const climbSeamDirScratch = useRef(new Vector3())
  const vScratch = useRef(new Vector3())
  const qPart = useRef(new Quaternion())
  const qEnd = useRef(new Quaternion())
  const hingeOffsetScratch = useRef(new Vector3())
  const mantlePivotScratch = useRef(new Vector3())
  const mantleAxisScratch = useRef(new Vector3())

  useFrame((_, delta) => {
    if (buildMode) return

    const dt = Math.min(Math.max(0, delta), MAX_FRAME_DELTA)
    const pos = playerPositionRef.current
    const quat = playerQuaternionRef.current

    const climb = climbingRef.current
    if (climb) {
      climb.u += dt / climb.duration
      const t = Math.min(1, climb.u)
      const path = climb.path
      if (path.kind === 'hinge') {
        evalHingeClimbFrame(
          path.pivot,
          path.v0,
          path.axis,
          path.angle,
          t,
          pos,
          quat,
          climb.q0,
          qPart.current,
          hingeOffsetScratch.current,
        )
        if (climbSameCellXZ(climb.from, climb.to)) {
          clampBesideWallHingePos(pos, climb.from, climb.climbDir)
        }
      } else {
        evalMantleFrame(path.curve, t, pos)
        evalMantleSeamRollRotation(
          climb.from,
          climb.to,
          climb.climbDir,
          climb.q0,
          t,
          quat,
          qPart.current,
          mantlePivotScratch.current,
          mantleAxisScratch.current,
        )
      }
      if (t >= 1) {
        pos.copy(climb.to)
        snapPlayerToGridXZ(pos)
        const landedFeet = pos.y - PLAYER_HALF
        const sup = getSupportSurfaceWorld(pos.x, pos.z, landedFeet)
        // Snap Y only when landing on real voxel tops in this column (not void).
        if (Number.isFinite(sup) && Math.abs(sup - landedFeet) <= 0.18) {
          pos.y = sup + PLAYER_HALF
        }
        quat.copy(climb.q1)
        climbingRef.current = null
        vyRef.current = 0
      }
      syncCameraTarget(pos, controlsRef)
      return
    }

    const active = rollingRef.current
    if (active) {
      active.u += dt / ROLL_SECONDS
      const t = Math.min(1, active.u)
      const sm = t * t * (3 - 2 * t)
      const angle = sm * Math.PI * 0.5

      vScratch.current.copy(active.v0).applyAxisAngle(active.axis, angle)
      pos.copy(active.pivot).add(vScratch.current)

      qPart.current.setFromAxisAngle(active.axis, angle)
      quat.multiplyQuaternions(qPart.current, active.q0)

      if (t >= 1) {
        quat.copy(active.q1)
        if (active.freeFallAfterRoll) {
          snapPlayerToGridXZ(pos)
          rollingRef.current = null
          vyRef.current = 0
          edgeDropPendingRef.current = true
        } else {
          pos.copy(active.endPos)
          snapPlayerToGridXZ(pos)
          pos.y = active.endPos.y
          rollingRef.current = null
          vyRef.current = 0
        }
      }

      syncCameraTarget(pos, controlsRef)
      return
    }

    snapPlayerToGridXZ(pos)
    let feet = pos.y - PLAYER_HALF
    let topo = getSupportSurfaceWorld(pos.x, pos.z, feet)
    const climbRest = isAdjacentClimbRest(pos)
    const onSupport =
      !edgeDropPendingRef.current &&
      vyRef.current <= 0 &&
      (Math.abs(feet - topo) < 0.08 || climbRest)

    if (jumpPendingRef.current && onSupport) {
      jumpPendingRef.current = false
      vyRef.current = JUMP_VELOCITY
    }

    // If climbRest is true with vy === 0, we are on a mid-climb tier: do not treat as in-air
    // from height alone (gravity would pull us off). If vy ≠ 0 (jump / fall), always in-air
    // even beside a wall — otherwise !climbRest && … would skip gravity and freeze the cube.
    const inAir =
      edgeDropPendingRef.current ||
      vyRef.current !== 0 ||
      (!climbRest && feet > topo + 0.05)

    if (inAir) {
      vyRef.current -= GRAVITY * dt
      pos.y += vyRef.current * dt
    }

    feet = pos.y - PLAYER_HALF
    topo = getSupportSurfaceWorld(pos.x, pos.z, feet)
    if (feet <= topo && vyRef.current < 0) {
      pos.y = topo + PLAYER_HALF
      vyRef.current = 0
      edgeDropPendingRef.current = false
    }

    feet = pos.y - PLAYER_HALF
    topo = getSupportSurfaceWorld(pos.x, pos.z, feet)
    const climbRestStable = isAdjacentClimbRest(pos)
    if (vyRef.current === 0 && Math.abs(feet - topo) < 0.1 && !climbRestStable) {
      snapPlayerToGridXZ(pos)
      const standFeet = pos.y - PLAYER_HALF
      pos.y = getSupportSurfaceWorld(pos.x, pos.z, standFeet) + PLAYER_HALF
      edgeDropPendingRef.current = false
    }

    feet = pos.y - PLAYER_HALF
    topo = getSupportSurfaceWorld(pos.x, pos.z, feet)
    const groundedForActions =
      !edgeDropPendingRef.current &&
      vyRef.current === 0 &&
      (Math.abs(feet - topo) < 0.08 || isAdjacentClimbRest(pos))

    if (groundedForActions) {
      const q = keyQueue.current
      if (q.length > 0) {
        const key = q.shift()!
        const dir = cardinalDirFromKey(camera, key)

        rollEndCenter(pos, dir, endScratch.current)

        const tryStartClimb = (climbDir: Vector3) => {
          const from = pos.clone()
          const to = climbTargetScratch.current.clone()
          const path = createClimbPath(from, to, climbDir)
          const mantleDur = CLIMB_BASE_SECONDS + CLIMB_MANTLE_EXTRA
          // One π/2 hinge matches ground roll time; larger snapped angles (rare) scale linearly.
          const hingeDur =
            path.kind === 'hinge'
              ? ROLL_SECONDS *
                Math.max(1, Math.abs(path.angle) / (Math.PI * 0.5))
              : mantleDur
          const q0 = quat.clone()
          climbEndQuaternion(
            path,
            from,
            to,
            climbDir,
            q0,
            qPart.current,
            mantlePivotScratch.current,
            mantleAxisScratch.current,
            qEnd.current,
          )
          climbingRef.current = {
            u: 0,
            duration: path.kind === 'hinge' ? hingeDur : mantleDur,
            path,
            from,
            climbDir: climbDir.clone(),
            to,
            q0,
            q1: qEnd.current.clone(),
          }
        }

        if (getClimbTargetIfValid(pos, dir, climbTargetScratch.current)) {
          tryStartClimb(dir)
          syncCameraTarget(pos, controlsRef)
          return
        }

        snapPlayerToGridXZ(pos)
        const cellIx = Math.round(pos.x)
        const cellIz = Math.round(pos.z)
        const feetH = pos.y - PLAYER_HALF
        const localTopo = getTerrainTopWorld(cellIx, cellIz)
        const moreStackAbove = localTopo > feetH + 1e-3

        if (
          moreStackAbove &&
          getClimbUpOneStepIfValid(
            pos,
            climbTargetScratch.current,
            climbSeamDirScratch.current,
          )
        ) {
          tryStartClimb(climbSeamDirScratch.current)
          syncCameraTarget(pos, controlsRef)
          return
        }

        if (canRollLandAt(pos, endScratch.current)) {
          rollPivot(pos, dir, pivotScratch.current)
          rollAxis(dir, axisScratch.current)

          vScratch.current.subVectors(pos, pivotScratch.current)
          quaternionAfterRoll(axisScratch.current, quat, qEnd.current)

          const fromFeet = pos.y - PLAYER_HALF
          const destTopo = getSupportSurfaceWorld(
            endScratch.current.x,
            endScratch.current.z,
            fromFeet,
          )
          const freeFallAfterRoll = destTopo < fromFeet - 1e-3

          rollingRef.current = {
            u: 0,
            pivot: pivotScratch.current.clone(),
            axis: axisScratch.current.clone(),
            v0: vScratch.current.clone(),
            q0: quat.clone(),
            q1: qEnd.current.clone(),
            endPos: endScratch.current.clone(),
            freeFallAfterRoll,
          }
          syncCameraTarget(pos, controlsRef)
          return
        }

        syncCameraTarget(pos, controlsRef)
        return
      }
    }

    syncCameraTarget(pos, controlsRef)
  })

  return null
}

function syncCameraTarget(
  pos: Vector3,
  controlsRef: RefObject<OrbitControlsImpl | null>,
) {
  const ctrl = controlsRef.current
  if (ctrl) {
    ctrl.target.set(pos.x, pos.y, pos.z)
    ctrl.update()
  }
}
