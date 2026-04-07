import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { MutableRefObject } from 'react'
import type { Quaternion, Vector3 } from 'three'

type PlayerProps = {
  positionRef: MutableRefObject<Vector3>
  quaternionRef: MutableRefObject<Quaternion>
}

const COLOR = '#7dd3c0'
const EMISSIVE = '#2a8f7a'

export function Player({ positionRef, quaternionRef }: PlayerProps) {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    g.position.copy(positionRef.current)
    g.quaternion.copy(quaternionRef.current)
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR}
          emissive={EMISSIVE}
          emissiveIntensity={0.18}
          metalness={0.15}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}
