/** Scene lighting / atmosphere; dev UI edits these, production uses defaults. */
export type WorldLightingSettings = {
  backgroundColor: string
  fogColor: string
  fogNear: number
  fogFar: number
  ambientColor: string
  ambientIntensity: number
  directionalColor: string
  directionalIntensity: number
  environmentIntensity: number
}

export const defaultWorldLighting: WorldLightingSettings = {
  backgroundColor: '#0c0e12',
  fogColor: '#0c0e12',
  fogNear: 34,
  fogFar: 72,
  ambientColor: '#ffffff',
  ambientIntensity: 0.48,
  directionalColor: '#ffffff',
  directionalIntensity: 1.2,
  environmentIntensity: 0.22,
}
