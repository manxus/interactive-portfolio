import {
  defaultLightBlockConfig,
  type LightBlockConfig,
} from '../data/terrain'

const STORAGE_KEY = 'interactive-portfolio:light-block-defaults'
const SCHEMA_VERSION = 1

type StoredPayload = {
  v: number
} & LightBlockConfig

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function isFiniteNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

export function loadLightBlockDefaults(): LightBlockConfig | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (typeof data !== 'object' || data === null) return null
    const rec = data as Record<string, unknown>
    if (rec.v !== SCHEMA_VERSION) return null

    const base = defaultLightBlockConfig
    const next: LightBlockConfig = { ...base }

    if (isFiniteNum(rec.distance))
      next.distance = clamp(rec.distance, 2, 48)
    if (isFiniteNum(rec.decay)) next.decay = clamp(rec.decay, 0, 2)
    if (isFiniteNum(rec.intensity))
      next.intensity = clamp(rec.intensity, 0, 12)
    if (isFiniteNum(rec.intensityPulse))
      next.intensityPulse = clamp(rec.intensityPulse, 0, 8)
    if (isFiniteNum(rec.pulseSpeed))
      next.pulseSpeed = clamp(rec.pulseSpeed, 0, 16)
    if (isFiniteNum(rec.coreBrightness))
      next.coreBrightness = clamp(rec.coreBrightness, 0, 6)
    if (isFiniteNum(rec.corePulse))
      next.corePulse = clamp(rec.corePulse, 0, 4)
    if (isFiniteNum(rec.coreRadius))
      next.coreRadius = clamp(rec.coreRadius, 0.08, 0.48)
    if (isFiniteNum(rec.shellGlow))
      next.shellGlow = clamp(rec.shellGlow, 0, 1.5)
    if (isFiniteNum(rec.shellGlowPulse))
      next.shellGlowPulse = clamp(rec.shellGlowPulse, 0, 1)
    if (isFiniteNum(rec.coreScaleBase))
      next.coreScaleBase = clamp(rec.coreScaleBase, 0.65, 1.15)
    if (isFiniteNum(rec.coreScalePulse))
      next.coreScalePulse = clamp(rec.coreScalePulse, 0, 0.35)

    return next
  } catch {
    return null
  }
}

export function saveLightBlockDefaults(config: LightBlockConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: StoredPayload = { v: SCHEMA_VERSION, ...config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}
