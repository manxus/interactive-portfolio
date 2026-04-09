import { WORLD_HALF } from '../scene/collision'

export type EditorBrushShape = 'area' | 'line' | 'circle' | 'pillar'

export type LineAxis = 'x' | 'y' | 'z'

/** All numeric fields are kept in sync; only fields for the active shape are used. */
export type BrushParams = {
  areaWidth: number
  areaHeight: number
  areaDepth: number
  lineAxis: LineAxis
  lineLength: number
  circleRadius: number
  pillarRadius: number
  pillarHeight: number
}

export type EditorBrushState = { shape: EditorBrushShape } & BrushParams

const MIN_BLOCK_Y = -24.5
const MAX_BLOCK_Y = 24.5

export const MAX_BRUSH_EXTENT = 64

export function defaultBrushState(): EditorBrushState {
  return {
    shape: 'area',
    areaWidth: 1,
    areaHeight: 1,
    areaDepth: 1,
    lineAxis: 'x',
    lineLength: 4,
    circleRadius: 3,
    pillarRadius: 0,
    pillarHeight: 5,
  }
}

function inWorld(x: number, y: number, z: number): boolean {
  const lim = WORLD_HALF - 1
  if (Math.abs(x) > lim || Math.abs(z) > lim) return false
  if (y < MIN_BLOCK_Y || y > MAX_BLOCK_Y) return false
  return true
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

/**
 * Integer voxel centers for the brush anchored at (ax, ay, az).
 * Area / line / pillar: anchor is the start (minimum corner for the box).
 * Circle: anchor is the center on the horizontal plane (same Y as placement).
 * Pillar: fills a vertical stack from anchor Y; XZ footprint is a disk of pillarRadius.
 */
export function cellsForBrush(
  ax: number,
  ay: number,
  az: number,
  shape: EditorBrushShape,
  p: BrushParams,
): [number, number, number][] {
  const out: [number, number, number][] = []
  const seen = new Set<string>()
  const add = (x: number, y: number, z: number) => {
    if (!inWorld(x, y, z)) return
    const k = `${x},${y},${z}`
    if (seen.has(k)) return
    seen.add(k)
    out.push([x, y, z])
  }

  switch (shape) {
    case 'area': {
      const w = clampInt(p.areaWidth, 1, MAX_BRUSH_EXTENT)
      const h = clampInt(p.areaHeight, 1, MAX_BRUSH_EXTENT)
      const d = clampInt(p.areaDepth, 1, MAX_BRUSH_EXTENT)
      for (let ix = 0; ix < w; ix++) {
        for (let iy = 0; iy < h; iy++) {
          for (let iz = 0; iz < d; iz++) {
            add(ax + ix, ay + iy, az + iz)
          }
        }
      }
      break
    }
    case 'line': {
      const L = clampInt(p.lineLength, 1, MAX_BRUSH_EXTENT * 2)
      const axis = p.lineAxis
      for (let i = 0; i < L; i++) {
        if (axis === 'x') add(ax + i, ay, az)
        else if (axis === 'y') add(ax, ay + i, az)
        else add(ax, ay, az + i)
      }
      break
    }
    case 'circle': {
      const R = clampInt(p.circleRadius, 0, MAX_BRUSH_EXTENT)
      const R2 = R * R
      for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
          if (dx * dx + dz * dz <= R2) add(ax + dx, ay, az + dz)
        }
      }
      break
    }
    case 'pillar': {
      const R = clampInt(p.pillarRadius, 0, MAX_BRUSH_EXTENT)
      const H = clampInt(p.pillarHeight, 1, MAX_BRUSH_EXTENT)
      const R2 = R * R
      for (let iy = 0; iy < H; iy++) {
        for (let dx = -R; dx <= R; dx++) {
          for (let dz = -R; dz <= R; dz++) {
            if (dx * dx + dz * dz <= R2) add(ax + dx, ay + iy, az + dz)
          }
        }
      }
      break
    }
  }
  return out
}
