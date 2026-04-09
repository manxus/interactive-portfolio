import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuildMenu } from './editor/BuildMenu'
import { defaultBrushState, type EditorBrushState } from './editor/brushCells'
import { loadBuildDraft, saveBuildDraft } from './editor/buildDraftStorage'
import {
  committedTerrainVoxels,
  exhibitOccupiedCenterKeys,
  portfolioEntries,
  type PortfolioEntry,
} from './data/portfolio'
import {
  defaultWorldLighting,
  type WorldLightingSettings,
} from './data/worldLighting'
import {
  defaultLightBlockConfig,
  type LightBlockConfig,
  type TerrainVoxel,
} from './data/terrain'
import { loadLightBlockDefaults, saveLightBlockDefaults } from './editor/lightBlockConfigStorage'
import { loadWorldLighting, saveWorldLighting } from './editor/worldLightingStorage'
import { PortfolioScene } from './scene/PortfolioScene'
import type { EditorPlaceKind, EditorTool } from './scene/TerrainEditor'
import './App.css'

const isDev = import.meta.env.DEV

let devEditorBootstrap:
  | { terrain: TerrainVoxel[]; exhibits: PortfolioEntry[] }
  | undefined

function initialDevEditorState(): {
  terrain: TerrainVoxel[]
  exhibits: PortfolioEntry[]
} {
  if (!isDev) return { terrain: [], exhibits: [] }
  if (!devEditorBootstrap) {
    const saved = loadBuildDraft()
    devEditorBootstrap = saved
      ? { terrain: saved.voxels, exhibits: saved.exhibits }
      : {
          terrain: structuredClone(committedTerrainVoxels),
          exhibits: [],
        }
  }
  return devEditorBootstrap
}

function initialWorldLighting(): WorldLightingSettings {
  if (!isDev) return defaultWorldLighting
  return loadWorldLighting() ?? defaultWorldLighting
}

function initialLightBlockConfig(): LightBlockConfig {
  if (!isDev) return defaultLightBlockConfig
  return loadLightBlockDefaults() ?? defaultLightBlockConfig
}

function App() {
  const [controlsOpen, setControlsOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [terrainDraft, setTerrainDraft] = useState<TerrainVoxel[]>(() =>
    isDev ? initialDevEditorState().terrain : [],
  )
  const [draftExhibits, setDraftExhibits] = useState<PortfolioEntry[]>(() =>
    isDev ? initialDevEditorState().exhibits : [],
  )
  const [buildMode, setBuildMode] = useState(false)
  const [editorTool, setEditorTool] = useState<EditorTool>('place')
  const [editorPlaceKind, setEditorPlaceKind] =
    useState<EditorPlaceKind>('terrain')
  const [editorColor, setEditorColor] = useState('#3d4a5c')
  const [editorBrush, setEditorBrush] = useState<EditorBrushState>(
    defaultBrushState,
  )
  const [worldLighting, setWorldLighting] = useState<WorldLightingSettings>(
    initialWorldLighting,
  )
  const [lightBlockConfig, setLightBlockConfig] = useState<LightBlockConfig>(
    initialLightBlockConfig,
  )

  const sceneTerrain = isDev ? terrainDraft : committedTerrainVoxels

  const staticExhibitKeys = exhibitOccupiedCenterKeys()

  const onTerrainChange = useCallback((next: TerrainVoxel[]) => {
    if (isDev) setTerrainDraft(next)
  }, [])

  useEffect(() => {
    if (!isDev) return
    saveBuildDraft(terrainDraft, draftExhibits)
  }, [terrainDraft, draftExhibits])

  useEffect(() => {
    if (!isDev) return
    saveWorldLighting(worldLighting)
  }, [worldLighting])

  useEffect(() => {
    if (!isDev) return
    saveLightBlockDefaults(lightBlockConfig)
  }, [lightBlockConfig])

  const selectedEntry = useMemo(() => {
    if (!selectedId) return null
    const fromStatic = portfolioEntries.find((e) => e.id === selectedId)
    if (fromStatic) return fromStatic
    return draftExhibits.find((e) => e.id === selectedId) ?? null
  }, [selectedId, draftExhibits])

  return (
    <div className="app">
      <div className="canvas-layer">
        <Canvas
          shadows
          tabIndex={0}
          style={{ display: 'block', outline: 'none' }}
          camera={{ position: [14, 9, 14], fov: 45 }}
          dpr={[1, 2]}
          onPointerMissed={() => setSelectedId(null)}
        >
          <PortfolioScene
            terrainVoxels={sceneTerrain}
            portfolioEntries={portfolioEntries}
            draftExhibits={draftExhibits}
            onDraftExhibitsChange={setDraftExhibits}
            staticExhibitKeys={staticExhibitKeys}
            selectedId={selectedId}
            onSelectEntry={setSelectedId}
            buildMode={buildMode}
            editorTool={editorTool}
            editorPlaceKind={editorPlaceKind}
            editorColor={editorColor}
            editorBrush={editorBrush}
            onTerrainChange={onTerrainChange}
            worldLighting={worldLighting}
            lightBlockConfig={lightBlockConfig}
          />
        </Canvas>
      </div>
      <div className="overlay" aria-hidden={false}>
        <header className="overlay-top">
          <h1>Interactive portfolio</h1>
          <div className="controls-block">
            <button
              type="button"
              className="controls-toggle"
              onClick={() => setControlsOpen((o) => !o)}
              aria-expanded={controlsOpen}
              aria-controls="controls-detail"
            >
              Controls
              <span className="controls-chevron" aria-hidden>
                {controlsOpen ? '▾' : '▸'}
              </span>
            </button>
            {controlsOpen ? (
              <div id="controls-detail" className="controls-detail">
                <p className="hint-line">
                  <span className="hint-label">Move</span>{' '}
                  <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> tumble on
                  the 1×1 grid
                </p>
                <p className="hint-line">
                  <span className="hint-label">Climb</span> one tier per press
                  along a wall face; pivot on the top edge at the seam
                </p>
                <p className="hint-line">
                  <span className="hint-label">Jump</span> <kbd>Space</kbd>
                </p>
                <p className="hint-line">
                  <span className="hint-label">Look</span> drag to orbit the
                  camera (play mode). In <strong>build mode</strong>: left drag
                  pans, right drag orbits, wheel zooms; movement keys pause while
                  you edit.
                </p>
                <p className="hint-line">
                  <span className="hint-label">Projects</span> click a block in
                  the world to open details
                </p>
              </div>
            ) : null}
          </div>
          {isDev ? (
            <BuildMenu
              buildMode={buildMode}
              onBuildModeChange={setBuildMode}
              tool={editorTool}
              onToolChange={setEditorTool}
              placeKind={editorPlaceKind}
              onPlaceKindChange={setEditorPlaceKind}
              color={editorColor}
              onColorChange={setEditorColor}
              brush={editorBrush}
              onBrushChange={setEditorBrush}
              terrainDraft={terrainDraft}
              worldLighting={worldLighting}
              onWorldLightingChange={setWorldLighting}
              lightBlockConfig={lightBlockConfig}
              onLightBlockConfigChange={setLightBlockConfig}
            />
          ) : null}
        </header>
        {selectedEntry ? (
          <aside className="detail-panel" aria-label="Project details">
            <button
              type="button"
              className="close-btn"
              onClick={() => setSelectedId(null)}
              aria-label="Close details"
            >
              ×
            </button>
            <h2>{selectedEntry.title}</h2>
            <p className="summary">{selectedEntry.summary}</p>
            {selectedEntry.tags.length > 0 ? (
              <ul className="tags">
                {selectedEntry.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            {selectedEntry.links.length > 0 ? (
              <ul className="links">
                {selectedEntry.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
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
