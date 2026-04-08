import type { TerrainVoxel } from '../data/terrain'
import type { EditorPlaceKind, EditorTool } from '../scene/TerrainEditor'

type BuildMenuProps = {
  buildMode: boolean
  onBuildModeChange: (on: boolean) => void
  tool: EditorTool
  onToolChange: (t: EditorTool) => void
  placeKind: EditorPlaceKind
  onPlaceKindChange: (k: EditorPlaceKind) => void
  color: string
  onColorChange: (c: string) => void
  terrainDraft: TerrainVoxel[]
}

export function BuildMenu({
  buildMode,
  onBuildModeChange,
  tool,
  onToolChange,
  placeKind,
  onPlaceKindChange,
  color,
  onColorChange,
  terrainDraft,
}: BuildMenuProps) {
  const exportJson = () => {
    const text = JSON.stringify({ voxels: terrainDraft }, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'level.terrain.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const copyJson = async () => {
    const text = JSON.stringify({ voxels: terrainDraft }, null, 2)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <div className="build-menu">
      <div className="build-menu-title">Level editor (dev only)</div>
      <label className="build-menu-row">
        <input
          type="checkbox"
          checked={buildMode}
          onChange={(e) => onBuildModeChange(e.target.checked)}
        />
        Build mode — free camera; place only against block faces; erase / paint
        hover then click
      </label>
      <div className="build-menu-row build-menu-tools">
        <span>Tool</span>
        {(['place', 'erase', 'paint'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tool === t ? 'build-tool active' : 'build-tool'}
            onClick={() => onToolChange(t)}
            disabled={!buildMode}
          >
            {t}
          </button>
        ))}
      </div>
      {tool === 'place' ? (
        <div className="build-menu-row build-menu-tools">
          <span>Place</span>
          <button
            type="button"
            className={
              placeKind === 'terrain' ? 'build-tool active' : 'build-tool'
            }
            onClick={() => onPlaceKindChange('terrain')}
            disabled={!buildMode}
          >
            Terrain block
          </button>
          <button
            type="button"
            className={
              placeKind === 'project' ? 'build-tool active' : 'build-tool'
            }
            onClick={() => onPlaceKindChange('project')}
            disabled={!buildMode}
          >
            Project block
          </button>
        </div>
      ) : null}
      <label className="build-menu-row">
        Color (place / paint){' '}
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          disabled={!buildMode}
        />
      </label>
      <div className="build-menu-row build-menu-actions">
        <button type="button" onClick={exportJson}>
          Download level.terrain.json
        </button>
        <button type="button" onClick={() => void copyJson()}>
          Copy JSON
        </button>
      </div>
      <p className="build-menu-hint">
        <strong>Camera:</strong> left drag pan, right drag orbit, middle / wheel
        zoom, <kbd>Shift</kbd>+left drag orbit. <strong>Place</strong> click must
        raycast a terrain or project block — the new cell is the face-adjacent
        neighbor (no floating placements). Needs at least one block in the
        level to extend from (e.g. committed terrain). Vertical band about y
        −24.5–24.5 (half-integer voxel centers).
        Dev-only <strong>project</strong> blocks → copy into{' '}
        <code>portfolio.ts</code> for production. Export terrain JSON and commit.
      </p>
    </div>
  )
}
