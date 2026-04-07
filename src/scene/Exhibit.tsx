import { useState } from 'react'
import { useCursor } from '@react-three/drei'
import type { PortfolioEntry } from '../data/portfolio'

type ExhibitProps = {
  entry: PortfolioEntry
  highlighted: boolean
  onSelect: (id: string) => void
}

export function Exhibit({ entry, highlighted, onSelect }: ExhibitProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <group position={entry.position}>
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          onSelect(entry.id)
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={entry.color}
          emissive={entry.color}
          emissiveIntensity={highlighted ? 0.4 : hovered ? 0.15 : 0}
          metalness={0.2}
          roughness={0.45}
        />
      </mesh>
    </group>
  )
}
