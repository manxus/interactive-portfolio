import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

export function ScenePostFX() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        luminanceThreshold={0.55}
        luminanceSmoothing={0.35}
        intensity={0.35}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.12} darkness={0.42} />
    </EffectComposer>
  )
}
