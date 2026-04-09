import {
  defaultLightBlockConfig,
  type LightBlockConfig,
} from '../data/terrain'
import {
  defaultWorldLighting,
  type WorldLightingSettings,
} from '../data/worldLighting'
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
  worldLighting: WorldLightingSettings
  onWorldLightingChange: (next: WorldLightingSettings) => void
  lightBlockConfig: LightBlockConfig
  onLightBlockConfigChange: (next: LightBlockConfig) => void
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
  worldLighting,
  onWorldLightingChange,
  lightBlockConfig,
  onLightBlockConfigChange,
}: BuildMenuProps) {
  const patchBrush = (partial: Partial<EditorBrushState>) => {
    onBrushChange({ ...brush, ...partial })
  }

  const patchLightBlock = (partial: Partial<LightBlockConfig>) => {
    onLightBlockConfigChange({ ...lightBlockConfig, ...partial })
  }

  const patchWorldLighting = (partial: Partial<WorldLightingSettings>) => {
    let next: WorldLightingSettings = { ...worldLighting, ...partial }
    if (next.fogFar <= next.fogNear) {
      if (partial.fogNear !== undefined && partial.fogFar === undefined) {
        next = { ...next, fogFar: next.fogNear + 8 }
      } else if (partial.fogFar !== undefined && partial.fogNear === undefined) {
        next = { ...next, fogNear: Math.max(4, next.fogFar - 8) }
      } else {
        next = { ...next, fogNear: 34, fogFar: 72 }
      }
    }
    onWorldLightingChange(next)
  }

  const intField = (
    label: string,
    value: number,
    setValue: (n: number) => void,
    min: number,
    max: number,
    inputDisabled?: boolean,
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
        disabled={inputDisabled !== undefined ? inputDisabled : !buildMode}
      />
    </label>
  )

  const floatFieldAlways = (
    label: string,
    value: number,
    setValue: (n: number) => void,
    min: number,
    max: number,
    step: number,
  ) => (
    <label className="build-menu-row build-menu-brush-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value)
          const n = Number.isFinite(v) ? v : min
          setValue(Math.min(max, Math.max(min, n)))
        }}
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
          <button
            type="button"
            className={
              placeKind === 'light' ? 'build-tool active' : 'build-tool'
            }
            onClick={() => onPlaceKindChange('light')}
            disabled={!buildMode}
          >
            Light block
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

      <div className="build-menu-subtitle">World lighting</div>
      <label className="build-menu-row build-menu-light-row">
        <span>Background</span>
        <input
          type="color"
          value={worldLighting.backgroundColor}
          onChange={(e) =>
            patchWorldLighting({ backgroundColor: e.target.value })
          }
        />
      </label>
      <label className="build-menu-row build-menu-light-row">
        <span>Fog</span>
        <input
          type="color"
          value={worldLighting.fogColor}
          onChange={(e) => patchWorldLighting({ fogColor: e.target.value })}
        />
      </label>
      <label className="build-menu-row build-menu-light-row">
        <span>Ambient</span>
        <input
          type="color"
          value={worldLighting.ambientColor}
          onChange={(e) => patchWorldLighting({ ambientColor: e.target.value })}
        />
      </label>
      <label className="build-menu-row build-menu-light-row">
        <span>Sun (directional)</span>
        <input
          type="color"
          value={worldLighting.directionalColor}
          onChange={(e) =>
            patchWorldLighting({ directionalColor: e.target.value })
          }
        />
      </label>
      <div className="build-menu-brush-grid">
        {floatFieldAlways(
          'Ambient intensity',
          worldLighting.ambientIntensity,
          (n) => patchWorldLighting({ ambientIntensity: n }),
          0,
          4,
          0.05,
        )}
        {floatFieldAlways(
          'Sun intensity',
          worldLighting.directionalIntensity,
          (n) => patchWorldLighting({ directionalIntensity: n }),
          0,
          6,
          0.05,
        )}
        {floatFieldAlways(
          'Environment',
          worldLighting.environmentIntensity,
          (n) => patchWorldLighting({ environmentIntensity: n }),
          0,
          3,
          0.05,
        )}
        {intField(
          'Fog near',
          worldLighting.fogNear,
          (n) => patchWorldLighting({ fogNear: n }),
          4,
          200,
          false,
        )}
        {intField(
          'Fog far',
          worldLighting.fogFar,
          (n) => patchWorldLighting({ fogFar: n }),
          8,
          400,
          false,
        )}
      </div>
      <div className="build-menu-row build-menu-light-actions">
        <button
          type="button"
          onClick={() => onWorldLightingChange({ ...defaultWorldLighting })}
        >
          Reset lighting
        </button>
        <button
          type="button"
          onClick={() =>
            patchWorldLighting({
              fogColor: worldLighting.backgroundColor,
            })
          }
        >
          Fog = background
        </button>
      </div>

      {placeKind === 'light' ? (
        <>
          <div className="build-menu-subtitle">Light block</div>
          <p className="build-menu-light-hint">
            Used for new light placements. <strong>Paint</strong> a light voxel to
            apply these values (and the color above).
          </p>
          <div className="build-menu-brush-grid">
            {floatFieldAlways(
              'Light distance',
              lightBlockConfig.distance,
              (n) => patchLightBlock({ distance: n }),
              2,
              48,
              0.5,
            )}
            {floatFieldAlways(
              'Decay',
              lightBlockConfig.decay,
              (n) => patchLightBlock({ decay: n }),
              0,
              2,
              0.1,
            )}
            {floatFieldAlways(
              'Intensity',
              lightBlockConfig.intensity,
              (n) => patchLightBlock({ intensity: n }),
              0,
              12,
              0.05,
            )}
            {floatFieldAlways(
              'Intensity pulse',
              lightBlockConfig.intensityPulse,
              (n) => patchLightBlock({ intensityPulse: n }),
              0,
              8,
              0.05,
            )}
            {floatFieldAlways(
              'Pulse speed',
              lightBlockConfig.pulseSpeed,
              (n) => patchLightBlock({ pulseSpeed: n }),
              0,
              16,
              0.05,
            )}
            {floatFieldAlways(
              'Core glow',
              lightBlockConfig.coreBrightness,
              (n) => patchLightBlock({ coreBrightness: n }),
              0,
              6,
              0.05,
            )}
            {floatFieldAlways(
              'Core pulse',
              lightBlockConfig.corePulse,
              (n) => patchLightBlock({ corePulse: n }),
              0,
              4,
              0.05,
            )}
            {floatFieldAlways(
              'Core radius',
              lightBlockConfig.coreRadius,
              (n) => patchLightBlock({ coreRadius: n }),
              0.08,
              0.48,
              0.01,
            )}
            {floatFieldAlways(
              'Shell glow',
              lightBlockConfig.shellGlow,
              (n) => patchLightBlock({ shellGlow: n }),
              0,
              1.5,
              0.02,
            )}
            {floatFieldAlways(
              'Shell pulse',
              lightBlockConfig.shellGlowPulse,
              (n) => patchLightBlock({ shellGlowPulse: n }),
              0,
              1,
              0.02,
            )}
            {floatFieldAlways(
              'Core scale',
              lightBlockConfig.coreScaleBase,
              (n) => patchLightBlock({ coreScaleBase: n }),
              0.65,
              1.15,
              0.01,
            )}
            {floatFieldAlways(
              'Scale pulse',
              lightBlockConfig.coreScalePulse,
              (n) => patchLightBlock({ coreScalePulse: n }),
              0,
              0.35,
              0.01,
            )}
          </div>
          <div className="build-menu-row build-menu-light-actions">
            <button
              type="button"
              onClick={() =>
                onLightBlockConfigChange({ ...defaultLightBlockConfig })
              }
            >
              Reset light defaults
            </button>
          </div>
        </>
      ) : null}

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
        <strong>Light</strong> blocks use a solid shell (radial white → paint
        color on each face), a pulsing core, and colored point light; they
        serialize as <code>kind: &quot;light&quot;</code>. Dev-only{' '}
        <strong>project</strong> blocks → copy into <code>portfolio.ts</code> for
        production. Export terrain JSON and commit.
        Your terrain and placed project blocks are auto-saved in{' '}
        <code>localStorage</code> for this site so refreshes keep the draft.
        World lighting (colors and intensities) is saved separately in dev.
        Light block tuning is saved as defaults; each light can store a{' '}
        <code>light</code> object in terrain JSON (merged with built-in defaults).
      </p>
    </div>
  )
}
