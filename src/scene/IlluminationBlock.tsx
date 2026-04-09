import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  IcosahedronGeometry,
  MeshStandardMaterial,
} from 'three'
import type { Mesh, PointLight } from 'three'
import { resolveLightConfig, type TerrainVoxel } from '../data/terrain'

type IlluminationBlockProps = {
  voxel: TerrainVoxel
  eraseHighlighted?: boolean
}

/**
 * Solid 1×1×1 box: on each face, radial gradient from face center (white) to
 * edges/corners (tint). Uses in-plane distance from the dominant axis so each
 * visible face reads as a circle, similar from any viewing direction.
 */
function createRadialFaceGradientBox(tint: Color): BoxGeometry {
  const geo = new BoxGeometry(1, 1, 1)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const white = new Color('#ffffff')
  const scratch = new Color()
  const half = 0.5
  const rMax = Math.sqrt(half * half + half * half)

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) as number
    const py = pos.getY(i) as number
    const pz = pos.getZ(i) as number
    const ax = Math.abs(px)
    const ay = Math.abs(py)
    const az = Math.abs(pz)

    let r = 0
    if (ax >= ay && ax >= az) {
      r = Math.sqrt(py * py + pz * pz)
    } else if (ay >= ax && ay >= az) {
      r = Math.sqrt(px * px + pz * pz)
    } else {
      r = Math.sqrt(px * px + py * py)
    }

    const t = Math.max(0, Math.min(1, r / rMax))
    scratch.copy(white).lerp(tint, t)
    colors[i * 3] = scratch.r
    colors[i * 3 + 1] = scratch.g
    colors[i * 3 + 2] = scratch.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

export function IlluminationBlock({
  voxel,
  eraseHighlighted,
}: IlluminationBlockProps) {
  const [x, y, z] = voxel.position
  const k = `${x},${y},${z}`
  const lightRef = useRef<PointLight>(null)
  const coreRef = useRef<Mesh>(null)
  const cfg = useMemo(() => resolveLightConfig(voxel.light), [voxel.light])
  const baseColor = useMemo(() => new Color(voxel.color), [voxel.color])
  const shellGeo = useMemo(
    () => createRadialFaceGradientBox(baseColor),
    [baseColor],
  )
  const shellMat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        color: '#ffffff',
        metalness: 0.08,
        roughness: 0.42,
      }),
    [],
  )
  const coreMat = useMemo(
    () =>
      new MeshStandardMaterial({
        metalness: 0.12,
        roughness: 0.28,
        toneMapped: false,
      }),
    [],
  )
  const coreGeo = useMemo(
    () => new IcosahedronGeometry(cfg.coreRadius, 1),
    [cfg.coreRadius],
  )

  useEffect(() => {
    return () => {
      shellGeo.dispose()
    }
  }, [shellGeo])

  useEffect(() => {
    return () => {
      coreGeo.dispose()
    }
  }, [coreGeo])

  useLayoutEffect(() => {
    shellMat.emissive.copy(baseColor)
    coreMat.color.copy(baseColor)
    coreMat.emissive.copy(baseColor)
  }, [baseColor, shellMat, coreMat])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const w =
      cfg.pulseSpeed <= 0 ? 0 : Math.sin(t * cfg.pulseSpeed)
    const erase = eraseHighlighted ? 1.35 : 1
    const l = lightRef.current
    if (l) {
      l.color.copy(baseColor)
      l.intensity = (cfg.intensity + cfg.intensityPulse * w) * erase
    }
    const core = coreRef.current
    if (core) {
      coreMat.emissive.copy(baseColor)
      coreMat.emissiveIntensity =
        (cfg.coreBrightness + cfg.corePulse * w) * erase
      const s = cfg.coreScaleBase + cfg.coreScalePulse * w
      core.scale.setScalar(Math.max(0.2, s))
    }
    shellMat.emissive.copy(baseColor)
    shellMat.emissiveIntensity =
      (cfg.shellGlow + cfg.shellGlowPulse * w) * erase +
      (eraseHighlighted ? 0.22 : 0)
  })

  return (
    <group position={[x, y, z]}>
      <pointLight
        ref={lightRef}
        position={[0, 0, 0]}
        distance={cfg.distance}
        decay={cfg.decay}
        castShadow={false}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={shellGeo}
        material={shellMat}
        userData={{
          terrainVoxelKey: k,
          buildBlockCenter: [x, y, z] as [number, number, number],
        }}
      />
      <mesh
        ref={coreRef}
        geometry={coreGeo}
        material={coreMat}
        raycast={() => {
          /* Picking uses outer shell. */
        }}
      />
    </group>
  )
}
