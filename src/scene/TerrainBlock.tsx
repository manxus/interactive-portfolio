import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, EdgesGeometry, LineBasicMaterial } from 'three'
import type { LineSegments } from 'three'
import type { TerrainVoxel } from '../data/terrain'

type TerrainBlockProps = {
  voxel: TerrainVoxel
  eraseHighlighted?: boolean
}

export function TerrainBlock({ voxel, eraseHighlighted }: TerrainBlockProps) {
  const [x, y, z] = voxel.position
  const k = `${x},${y},${z}`
  const edgesRef = useRef<LineSegments>(null)

  const edgesGeo = useMemo(
    () => new EdgesGeometry(new BoxGeometry(1, 1, 1)),
    [],
  )

  const edgeColor = eraseHighlighted ? '#ff8877' : '#0a0a0a'

  const lineMat = useMemo(() => new LineBasicMaterial({ color: '#0a0a0a' }), [])

  useLayoutEffect(() => {
    lineMat.color.set(edgeColor)
  }, [edgeColor, lineMat])

  useLayoutEffect(() => {
    const seg = edgesRef.current
    if (seg) {
      seg.raycast = () => {
        /* Visual only — picking uses the solid mesh. */
      }
    }
  }, [])

  return (
    <group position={[x, y, z]}>
      <mesh
        castShadow
        receiveShadow
        userData={{
          terrainVoxelKey: k,
          buildBlockCenter: [x, y, z] as [number, number, number],
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={voxel.color}
          metalness={0.08}
          roughness={0.82}
          emissive={eraseHighlighted ? '#ff6b5e' : '#000000'}
          emissiveIntensity={eraseHighlighted ? 0.18 : 0}
        />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edgesGeo} material={lineMat} />
    </group>
  )
}
