import { useState } from 'react'
import { Html, Outlines, RoundedBox, useCursor } from '@react-three/drei'
import type { PortfolioEntry } from '../data/portfolio'

type ExhibitProps = {
  entry: PortfolioEntry
  highlighted: boolean
  onSelect: (id: string) => void
  /** Dev editor: raycast id for erase / hover (only on blocks placed from build mode). */
  draftExhibitId?: string
  eraseHighlighted?: boolean
  /** In build mode, clicks place/erase/paint instead of opening project details. */
  suppressSelection?: boolean
}

export function Exhibit({
  entry,
  highlighted,
  onSelect,
  draftExhibitId,
  eraseHighlighted,
  suppressSelection,
}: ExhibitProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <group position={entry.position}>
      <RoundedBox
        args={[1, 1, 1]}
        radius={0.06}
        smoothness={4}
        castShadow
        receiveShadow
        userData={{
          buildBlockCenter: entry.position,
          ...(draftExhibitId ? { exhibitDraftId: draftExhibitId } : {}),
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (suppressSelection) return
          onSelect(entry.id)
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={entry.color}
          emissive={entry.color}
          emissiveIntensity={
            highlighted ? 0.4 : eraseHighlighted ? 0.25 : hovered ? 0.15 : 0
          }
          metalness={0.22}
          roughness={0.42}
        />
        {highlighted ? (
          <Outlines thickness={0.038} color="#f4f6fb" opacity={0.9} />
        ) : eraseHighlighted ? (
          <Outlines thickness={0.034} color="#ffb4a8" opacity={0.95} />
        ) : hovered ? (
          <Outlines thickness={0.022} color="#e8ecf4" opacity={0.45} />
        ) : null}
      </RoundedBox>
      <Html
        position={[0, 0.72, 0]}
        center
        distanceFactor={11}
        zIndexRange={[50, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="exhibit-label">{entry.title}</div>
      </Html>
    </group>
  )
}
