import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { portfolioEntries } from './data/portfolio'
import { PortfolioScene } from './scene/PortfolioScene'
import './App.css'

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = portfolioEntries.find((p) => p.id === selectedId) ?? null

  return (
    <div className="app">
      <div className="canvas-layer">
        <Canvas
          shadows
          camera={{ position: [14, 9, 14], fov: 45 }}
          dpr={[1, 2]}
          onPointerMissed={() => setSelectedId(null)}
        >
          <PortfolioScene
            selectedId={selectedId}
            onSelectExhibit={setSelectedId}
          />
        </Canvas>
      </div>
      <div className="overlay" aria-hidden={false}>
        <header className="overlay-top">
          <h1>Interactive portfolio</h1>
          <p className="hint">
            1×1 grid — WASD tumble · climbs pivot on the top edge at the wall and roll up the face
            (one tier per press) · Space jump · drag to orbit · click a project block
          </p>
        </header>
        {selected ? (
          <aside className="detail-panel" role="dialog" aria-labelledby="detail-title">
            <button
              type="button"
              className="close-btn"
              onClick={() => setSelectedId(null)}
              aria-label="Close project details"
            >
              ×
            </button>
            <h2 id="detail-title">{selected.title}</h2>
            <p className="summary">{selected.summary}</p>
            {selected.tags.length > 0 ? (
              <ul className="tags">
                {selected.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            {selected.links.length > 0 ? (
              <ul className="links">
                {selected.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

export default App
