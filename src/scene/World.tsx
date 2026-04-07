import { Grid } from '@react-three/drei'
import { portfolioEntries } from '../data/portfolio'
import { Exhibit } from './Exhibit'

type WorldProps = {
  selectedId: string | null
  onSelectExhibit: (id: string) => void
}

export function World({ selectedId, onSelectExhibit }: WorldProps) {
  return (
    <>
      <color attach="background" args={['#0c0e12']} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[12, 20, 10]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={40}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[48, 48]} />
        <meshStandardMaterial color="#141820" metalness={0.05} roughness={0.9} />
      </mesh>
      <Grid
        args={[48, 48]}
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        cellSize={1}
        cellThickness={0.55}
        cellColor="#2a3240"
        sectionSize={5}
        sectionThickness={0.9}
        sectionColor="#3d4a5c"
        fadeDistance={52}
        fadeStrength={1}
        infiniteGrid={false}
      />
      {portfolioEntries.map((entry) => (
        <Exhibit
          key={entry.id}
          entry={entry}
          highlighted={selectedId === entry.id}
          onSelect={onSelectExhibit}
        />
      ))}
    </>
  )
}
