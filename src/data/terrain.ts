/** `light` = lantern voxel with emissive core + local point light. */
export type TerrainVoxelKind = 'solid' | 'light'

/** Tunable lamp behavior; stored per voxel under `light` (partial allowed). */
export type LightBlockConfig = {
  /** Point light falloff distance (world units). */
  distance: number
  decay: number
  /** Baseline point light intensity; pulse adds on top. */
  intensity: number
  /** Peak extra intensity from the sine pulse (0 = steady light). */
  intensityPulse: number
  /** Pulse frequency (radians per second for sin(time * this)). */
  pulseSpeed: number
  /** Inner core emissive intensity baseline. */
  coreBrightness: number
  /** Extra core emissive from pulse. */
  corePulse: number
  /** Icosahedron radius. */
  coreRadius: number
  /** Shell emissive baseline (rim glow). */
  shellGlow: number
  /** Shell emissive pulse amplitude. */
  shellGlowPulse: number
  /** Core mesh scale baseline (1 = authored radius only). */
  coreScaleBase: number
  /** Core scale pulse amplitude. */
  coreScalePulse: number
}

export const defaultLightBlockConfig: LightBlockConfig = {
  distance: 13,
  decay: 2,
  intensity: 2.15,
  intensityPulse: 0.55,
  pulseSpeed: 2.35,
  coreBrightness: 1.05,
  corePulse: 0.35,
  coreRadius: 0.26,
  shellGlow: 0.12,
  shellGlowPulse: 0.06,
  coreScaleBase: 0.92,
  coreScalePulse: 0.08,
}

export function resolveLightConfig(
  partial?: Partial<LightBlockConfig>,
): LightBlockConfig {
  return { ...defaultLightBlockConfig, ...partial }
}

export type TerrainVoxel = {
  position: [number, number, number]
  color: string
  kind?: TerrainVoxelKind
  /** When `kind` is `light`, optional overrides (merged with defaults at runtime). */
  light?: Partial<LightBlockConfig>
}
