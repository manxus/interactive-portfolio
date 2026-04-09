import type { PortfolioEntry, PortfolioLink } from '../data/portfolio'
import type { TerrainVoxel } from '../data/terrain'

const STORAGE_KEY = 'interactive-portfolio:build-draft'
const SCHEMA_VERSION = 1

type StoredPayload = {
  v: number
  voxels: TerrainVoxel[]
  exhibits: PortfolioEntry[]
}

function isNum3(t: unknown): t is [number, number, number] {
  return (
    Array.isArray(t) &&
    t.length === 3 &&
    typeof t[0] === 'number' &&
    typeof t[1] === 'number' &&
    typeof t[2] === 'number'
  )
}

const LIGHT_BLOCK_KEYS = [
  'distance',
  'decay',
  'intensity',
  'intensityPulse',
  'pulseSpeed',
  'coreBrightness',
  'corePulse',
  'coreRadius',
  'shellGlow',
  'shellGlowPulse',
  'coreScaleBase',
  'coreScalePulse',
] as const

function isLightBlockPartial(x: unknown): boolean {
  if (x === undefined) return true
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  for (const k of LIGHT_BLOCK_KEYS) {
    if (o[k] !== undefined && typeof o[k] !== 'number') return false
  }
  return true
}

function isTerrainVoxel(x: unknown): x is TerrainVoxel {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  if (typeof o.color !== 'string' || !isNum3(o.position)) return false
  if (
    o.kind !== undefined &&
    o.kind !== 'solid' &&
    o.kind !== 'light'
  ) {
    return false
  }
  if (o.light !== undefined && !isLightBlockPartial(o.light)) return false
  return true
}

function isPortfolioLink(x: unknown): x is PortfolioLink {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return typeof o.label === 'string' && typeof o.href === 'string'
}

function isPortfolioEntry(x: unknown): x is PortfolioEntry {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  if (
    typeof o.id !== 'string' ||
    typeof o.title !== 'string' ||
    typeof o.summary !== 'string' ||
    typeof o.color !== 'string' ||
    !isNum3(o.position) ||
    !Array.isArray(o.tags) ||
    !Array.isArray(o.links)
  ) {
    return false
  }
  if (!o.tags.every((t) => typeof t === 'string')) return false
  if (!o.links.every(isPortfolioLink)) return false
  return true
}

export function loadBuildDraft():
  | { voxels: TerrainVoxel[]; exhibits: PortfolioEntry[] }
  | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (typeof data !== 'object' || data === null) return null
    const rec = data as Record<string, unknown>
    const v = rec.v
    if (v !== SCHEMA_VERSION) return null
    if (!Array.isArray(rec.voxels) || !Array.isArray(rec.exhibits)) return null
    if (!rec.voxels.every(isTerrainVoxel)) return null
    if (!rec.exhibits.every(isPortfolioEntry)) return null
    return {
      voxels: rec.voxels,
      exhibits: rec.exhibits,
    }
  } catch {
    return null
  }
}

export function saveBuildDraft(
  voxels: TerrainVoxel[],
  exhibits: PortfolioEntry[],
): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: StoredPayload = { v: SCHEMA_VERSION, voxels, exhibits }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // quota, private mode, disabled storage
  }
}
