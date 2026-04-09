import {
  defaultWorldLighting,
  type WorldLightingSettings,
} from '../data/worldLighting'

const STORAGE_KEY = 'interactive-portfolio:world-lighting'
const SCHEMA_VERSION = 1

type StoredPayload = {
  v: number
} & WorldLightingSettings

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function isHex6(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s)
}

function isFiniteNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

export function loadWorldLighting(): WorldLightingSettings | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (typeof data !== 'object' || data === null) return null
    const rec = data as Record<string, unknown>
    if (rec.v !== SCHEMA_VERSION) return null

    const next: WorldLightingSettings = { ...defaultWorldLighting }

    if (isHex6(rec.backgroundColor)) next.backgroundColor = rec.backgroundColor
    if (isHex6(rec.fogColor)) next.fogColor = rec.fogColor
    if (isHex6(rec.ambientColor)) next.ambientColor = rec.ambientColor
    if (isHex6(rec.directionalColor)) next.directionalColor = rec.directionalColor

    if (isFiniteNum(rec.fogNear)) next.fogNear = clamp(rec.fogNear, 4, 200)
    if (isFiniteNum(rec.fogFar)) next.fogFar = clamp(rec.fogFar, 8, 400)
    if (next.fogFar <= next.fogNear) {
      next.fogNear = defaultWorldLighting.fogNear
      next.fogFar = defaultWorldLighting.fogFar
    }

    if (isFiniteNum(rec.ambientIntensity))
      next.ambientIntensity = clamp(rec.ambientIntensity, 0, 4)
    if (isFiniteNum(rec.directionalIntensity))
      next.directionalIntensity = clamp(rec.directionalIntensity, 0, 6)
    if (isFiniteNum(rec.environmentIntensity))
      next.environmentIntensity = clamp(rec.environmentIntensity, 0, 3)

    return next
  } catch {
    return null
  }
}

export function saveWorldLighting(settings: WorldLightingSettings): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: StoredPayload = { v: SCHEMA_VERSION, ...settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}
