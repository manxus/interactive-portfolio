import type { TerrainVoxel } from '../data/terrain'
import type { EditorPlaceKind, EditorTool } from '../scene/TerrainEditor'
import type { EditorBrushState, LineAxis } from './brushCells'
import { MAX_BRUSH_EXTENT } from './brushCells'

type BuildMenuProps = {
  buildMode: boolean
  onBuildModeChange: (on: boolean) => void
  tool: EditorTool
  onToolChange: (t: EditorTool) => void
  placeKind: EditorPlaceKind
  onPlaceKindChange: (k: EditorPlaceKind) => void
  color: string
  onColorChange: (c: string) => void
  brush: EditorBrushState
  onBrushChange: (next: EditorBrushState) => void
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
  brush,
  onBrushChange,
  terrainDraft,
}: BuildMenuProps) {
  const patchBrush = (partial: Partial<EditorBrushState>) => {
    onBrushChange({ ...brush, ...partial })
  }

  const intField = (
    label: string,
    value: number,
    setValue: (n: number) => void,
    min: number,
    max: number,
  ) => (
    <label className="build-menu-row build-menu-brush-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10)
          const n = Number.isFinite(v) ? v : min
          setValue(Math.min(max, Math.max(min, n)))
        }}
        disabled={!buildMode}
      />
    </label>
  )
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
      {tool === 'place' ? (
        <>
          <div className="build-menu-row build-menu-tools">
            <span>Brush</span>
            {(['area', 'line', 'circle', 'pillar'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={
                  brush.shape === s ? 'build-tool active' : 'build-tool'
                }
                onClick={() => patchBrush({ shape: s })}
                disabled={!buildMode}
              >
                {s}
              </button>
            ))}
          </div>
          {brush.shape === 'area' ? (
            <div className="build-menu-brush-grid">
              {intField(
                'Width (X)',
                brush.areaWidth,
                (n) => patchBrush({ areaWidth: n }),
                1,
                MAX_BRUSH_EXTENT,
              )}
              {intField(
                'Height (Y)',
                brush.areaHeight,
                (n) => patchBrush({ areaHeight: n }),
                1,
                MAX_BRUSH_EXTENT,
              )}
              {intField(
                'Depth (Z)',
                brush.areaDepth,
                (n) => patchBrush({ areaDepth: n }),
                1,
                MAX_BRUSH_EXTENT,
              )}
            </div>
          ) : null}
          {brush.shape === 'line' ? (
            <>
              <div className="build-menu-row build-menu-tools">
                <span>Axis</span>
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    className={
                      brush.lineAxis === axis ? 'build-tool active' : 'build-tool'
                    }
                    onClick={() => patchBrush({ lineAxis: axis as LineAxis })}
                    disabled={!buildMode}
                  >
                    {axis}
                  </button>
                ))}
              </div>
              {intField(
                'Length',
                brush.lineLength,
                (n) => patchBrush({ lineLength: n }),
                1,
                MAX_BRUSH_EXTENT * 2,
              )}
            </>
          ) : null}
          {brush.shape === 'circle'
            ? intField(
                'Radius',
                brush.circleRadius,
                (n) => patchBrush({ circleRadius: n }),
                0,
                MAX_BRUSH_EXTENT,
              )
            : null}
          {brush.shape === 'pillar' ? (
            <div className="build-menu-brush-grid">
              {intField(
                'Radius (XZ)',
                brush.pillarRadius,
                (n) => patchBrush({ pillarRadius: n }),
                0,
                MAX_BRUSH_EXTENT,
              )}
              {intField(
                'Height',
                brush.pillarHeight,
                (n) => patchBrush({ pillarHeight: n }),
                1,
                MAX_BRUSH_EXTENT,
              )}
            </div>
          ) : null}
        </>
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
        −24.5–24.5 (half-integer voxel centers). <strong>Brush:</strong> area
        fills a box from the anchor; line runs along an axis; circle is a flat
        disk (anchor = center); pillar stacks a disk upward (radius 0 = one
        column).
        Dev-only <strong>project</strong> blocks → copy into{' '}
        <code>portfolio.ts</code> for production. Export terrain JSON and commit.
        Your terrain and placed project blocks are auto-saved in{' '}
        <code>localStorage</code> for this site so refreshes keep the draft.
      </p>
    </div>
  )
}
