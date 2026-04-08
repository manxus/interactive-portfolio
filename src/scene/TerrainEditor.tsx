import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type {
  Camera,
  Group,
  Intersection,
  MeshBasicMaterial,
  Object3D,
  Scene,
} from 'three'
import { Color, Raycaster, Vector2, Vector3 } from 'three'
import type { PortfolioEntry } from '../data/portfolio'
import type { TerrainVoxel } from '../data/terrain'
import { WORLD_HALF } from './collision'

export type EditorTool = 'place' | 'erase' | 'paint'

export type EditorPlaceKind = 'terrain' | 'project'

export type EraseHoverPayload = {
  terrainKey: string | null
  draftExhibitId: string | null
}

type TerrainEditorProps = {
  enabled: boolean
  tool: EditorTool
  color: string
  placeKind: EditorPlaceKind
  terrainVoxels: TerrainVoxel[]
  onTerrainChange: (next: TerrainVoxel[]) => void
  draftExhibits: PortfolioEntry[]
  onDraftExhibitsChange: (next: PortfolioEntry[]) => void
  staticExhibitKeys: Set<string>
  onEraseHover?: (h: EraseHoverPayload) => void
}

const ndc = new Vector2()
const ndcPointer = new Vector2()
const raycaster = new Raycaster()

/**
 * Voxel centers are on the half grid (…, -0.5, 0.5, 1.5, …).
 * Allow the same span below “ground” as above (±24 steps from ±0.5 band).
 */
const MIN_BLOCK_Y = -24.5
const MAX_BLOCK_Y = 24.5

const scratchDelta = new Vector3()
const scratchNeighbor = new Vector3()
const previewColor = new Color()

function centerKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`
}

function blockCenterFromHit(hitResult: Intersection): [number, number, number] | null {
  let o: Object3D | null = hitResult.object
  while (o) {
    const bc = (
      o.userData as { buildBlockCenter?: [number, number, number] }
    ).buildBlockCenter
    if (bc) return bc
    o = o.parent
  }
  return null
}

/**
 * Adjacent cell in the direction from block center toward the hit point (any face / rounded edge).
 */
function neighborTowardHit(
  blockCenter: [number, number, number],
  hitPoint: Vector3,
  out: Vector3,
): boolean {
  const [bx, by, bz] = blockCenter
  scratchDelta.set(hitPoint.x - bx, hitPoint.y - by, hitPoint.z - bz)
  const ax = Math.abs(scratchDelta.x)
  const ay = Math.abs(scratchDelta.y)
  const az = Math.abs(scratchDelta.z)
  let ox = 0
  let oy = 0
  let oz = 0
  if (ax >= ay && ax >= az) ox = Math.sign(scratchDelta.x) || 1
  else if (ay >= ax && ay >= az) oy = Math.sign(scratchDelta.y) || 1
  else oz = Math.sign(scratchDelta.z) || 1
  out.set(bx + ox, by + oy, bz + oz)
  const lim = WORLD_HALF - 1
  if (Math.abs(out.x) > lim || Math.abs(out.z) > lim) return false
  if (out.y < MIN_BLOCK_Y || out.y > MAX_BLOCK_Y) return false
  return true
}

function firstErasePickFromClient(
  clientX: number,
  clientY: number,
  dom: HTMLCanvasElement,
  camera: Camera,
  scene: Scene,
): EraseHoverPayload {
  const rect = dom.getBoundingClientRect()
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(ndc, camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  for (const h of hits) {
    let o: object | null = h.object
    while (o) {
      const ud = (
        o as {
          userData?: {
            terrainVoxelKey?: string
            exhibitDraftId?: string
          }
        }
      ).userData
      if (ud?.terrainVoxelKey) {
        return { terrainKey: ud.terrainVoxelKey, draftExhibitId: null }
      }
      if (ud?.exhibitDraftId) {
        return { terrainKey: null, draftExhibitId: ud.exhibitDraftId }
      }
      o = (o as { parent?: object | null }).parent ?? null
    }
  }
  return { terrainKey: null, draftExhibitId: null }
}

function newDraftExhibit(
  position: [number, number, number],
  color: string,
): PortfolioEntry {
  return {
    id: `draft-${crypto.randomUUID()}`,
    title: 'New project',
    summary: 'Edit copy in src/data/portfolio.ts or add an export later.',
    tags: [],
    links: [],
    position,
    color,
  }
}

export function TerrainEditor({
  enabled,
  tool,
  color,
  placeKind,
  terrainVoxels,
  onTerrainChange,
  draftExhibits,
  onDraftExhibitsChange,
  staticExhibitKeys,
  onEraseHover,
}: TerrainEditorProps) {
  const { gl, camera, scene } = useThree()
  const terrainRef = useRef(terrainVoxels)
  const draftRef = useRef(draftExhibits)
  const staticKeysRef = useRef(staticExhibitKeys)
  const colorRef = useRef(color)
  const hoverEraseRef = useRef(false)
  const hoverPlaceRef = useRef(false)
  const ndcActiveRef = useRef(false)
  const lastEraseSigRef = useRef<string>('|')
  const onEraseHoverRef = useRef(onEraseHover)
  const previewGroupRef = useRef<Group>(null)
  const previewMatRef = useRef<MeshBasicMaterial>(null)

  useLayoutEffect(() => {
    onEraseHoverRef.current = onEraseHover
  }, [onEraseHover])

  useLayoutEffect(() => {
    terrainRef.current = terrainVoxels
  }, [terrainVoxels])

  useLayoutEffect(() => {
    draftRef.current = draftExhibits
  }, [draftExhibits])

  useLayoutEffect(() => {
    staticKeysRef.current = staticExhibitKeys
  }, [staticExhibitKeys])

  useLayoutEffect(() => {
    colorRef.current = color
  }, [color])

  useLayoutEffect(() => {
    hoverEraseRef.current = enabled && tool === 'erase'
    hoverPlaceRef.current = enabled && tool === 'place'
  }, [enabled, tool])

  useLayoutEffect(() => {
    if (!enabled || tool !== 'erase') {
      lastEraseSigRef.current = '|'
      onEraseHoverRef.current?.({ terrainKey: null, draftExhibitId: null })
      ndcActiveRef.current = false
    }
  }, [enabled, tool])

  useFrame(() => {
    const previewGroup = previewGroupRef.current
    const previewMat = previewMatRef.current

    if (hoverEraseRef.current) {
      if (!ndcActiveRef.current) {
        if (lastEraseSigRef.current !== '|') {
          lastEraseSigRef.current = '|'
          onEraseHoverRef.current?.({ terrainKey: null, draftExhibitId: null })
        }
      } else {
        raycaster.setFromCamera(ndcPointer, camera)
        const eraseHits = raycaster.intersectObjects(scene.children, true)
        let terrainKey: string | null = null
        let draftExhibitId: string | null = null
        hitSearch: for (const h of eraseHits) {
          let o: object | null = h.object
          while (o) {
            const ud = (
              o as {
                userData?: {
                  terrainVoxelKey?: string
                  exhibitDraftId?: string
                }
              }
            ).userData
            if (ud?.terrainVoxelKey) {
              terrainKey = ud.terrainVoxelKey
              draftExhibitId = null
              break hitSearch
            }
            if (ud?.exhibitDraftId) {
              terrainKey = null
              draftExhibitId = ud.exhibitDraftId
              break hitSearch
            }
            o = (o as { parent?: object | null }).parent ?? null
          }
        }
        const sig = `${terrainKey ?? ''}|${draftExhibitId ?? ''}`
        if (lastEraseSigRef.current !== sig) {
          lastEraseSigRef.current = sig
          onEraseHoverRef.current?.({ terrainKey, draftExhibitId })
        }
      }
    }

    if (!previewGroup || !previewMat) return

    if (!hoverPlaceRef.current || !ndcActiveRef.current) {
      previewGroup.visible = false
      return
    }

    raycaster.setFromCamera(ndcPointer, camera)
    const placeHits = raycaster.intersectObjects(scene.children, true)
    let placeOk = false
    for (const h of placeHits) {
      const bc = blockCenterFromHit(h)
      if (!bc) continue
      if (neighborTowardHit(bc, h.point, scratchNeighbor)) {
        placeOk = true
        break
      }
    }
    if (!placeOk) {
      previewGroup.visible = false
      return
    }

    const currentTerrain = terrainRef.current
    const currentDrafts = draftRef.current
    const sk = staticKeysRef.current
    const k = centerKey(
      scratchNeighbor.x,
      scratchNeighbor.y,
      scratchNeighbor.z,
    )
    if (sk.has(k)) {
      previewGroup.visible = false
      return
    }
    if (currentTerrain.some((v) => centerKey(...v.position) === k)) {
      previewGroup.visible = false
      return
    }
    if (currentDrafts.some((e) => centerKey(...e.position) === k)) {
      previewGroup.visible = false
      return
    }

    previewColor.set(colorRef.current)
    previewMat.color.copy(previewColor)
    previewGroup.position.copy(scratchNeighbor)
    previewGroup.visible = true
  })

  useEffect(() => {
    if (!enabled) return

    const dom = gl.domElement

    const cellOccupied = (
      sx: number,
      sy: number,
      sz: number,
      terrain: TerrainVoxel[],
      drafts: PortfolioEntry[],
      staticKeys: Set<string>,
    ) => {
      const k = centerKey(sx, sy, sz)
      if (staticKeys.has(k)) return true
      if (terrain.some((v) => centerKey(...v.position) === k)) return true
      if (drafts.some((e) => centerKey(...e.position) === k)) return true
      return false
    }

    const placeTargetFromClient = (
      clientX: number,
      clientY: number,
    ): [number, number, number] | null => {
      const rect = dom.getBoundingClientRect()
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      for (const h of hits) {
        const bc = blockCenterFromHit(h)
        if (!bc) continue
        if (neighborTowardHit(bc, h.point, scratchNeighbor)) {
          return [
            scratchNeighbor.x,
            scratchNeighbor.y,
            scratchNeighbor.z,
          ]
        }
      }
      return null
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!hoverEraseRef.current && !hoverPlaceRef.current) return
      const rect = dom.getBoundingClientRect()
      ndcPointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      ndcPointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ndcActiveRef.current = true
    }

    const onPointerLeave = () => {
      ndcActiveRef.current = false
      onEraseHoverRef.current?.({ terrainKey: null, draftExhibitId: null })
    }

    const onPlaceClick = (ev: MouseEvent) => {
      if (ev.button !== 0) return
      const currentTerrain = terrainRef.current
      const currentDrafts = draftRef.current
      const sk = staticKeysRef.current

      if (tool === 'paint') {
        const pick = firstErasePickFromClient(
          ev.clientX,
          ev.clientY,
          dom,
          camera,
          scene,
        )
        if (pick.terrainKey) {
          onTerrainChange(
            currentTerrain.map((v) =>
              centerKey(...v.position) === pick.terrainKey
                ? { ...v, color }
                : v,
            ),
          )
        }
        return
      }

      if (tool === 'erase') {
        const pick = firstErasePickFromClient(
          ev.clientX,
          ev.clientY,
          dom,
          camera,
          scene,
        )
        if (pick.terrainKey) {
          onTerrainChange(
            currentTerrain.filter(
              (v) => centerKey(...v.position) !== pick.terrainKey,
            ),
          )
          return
        }
        if (pick.draftExhibitId) {
          onDraftExhibitsChange(
            currentDrafts.filter((e) => e.id !== pick.draftExhibitId),
          )
        }
        return
      }

      const cell = placeTargetFromClient(ev.clientX, ev.clientY)
      if (!cell) return
      const [sx, sy, sz] = cell
      if (cellOccupied(sx, sy, sz, currentTerrain, currentDrafts, sk)) return

      if (placeKind === 'project') {
        onDraftExhibitsChange([
          ...currentDrafts,
          newDraftExhibit([sx, sy, sz], color),
        ])
        return
      }

      const idx = currentTerrain.findIndex(
        (v) => v.position[0] === sx && v.position[1] === sy && v.position[2] === sz,
      )
      if (idx >= 0) {
        const next = currentTerrain.slice()
        next[idx] = { position: [sx, sy, sz], color }
        onTerrainChange(next)
        return
      }
      onTerrainChange([...currentTerrain, { position: [sx, sy, sz], color }])
    }

    dom.addEventListener('click', onPlaceClick)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerleave', onPointerLeave)
    return () => {
      dom.removeEventListener('click', onPlaceClick)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [
    enabled,
    tool,
    color,
    placeKind,
    onTerrainChange,
    onDraftExhibitsChange,
    camera,
    gl,
    scene,
  ])

  return (
    <group ref={previewGroupRef} visible={false}>
      <mesh raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={previewMatRef}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
