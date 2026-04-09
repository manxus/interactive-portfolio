import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Camera, Group, Intersection, Object3D, Scene } from 'three'
import {
  BoxGeometry,
  Color,
  Matrix4,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import type { PortfolioEntry } from '../data/portfolio'
import type { LightBlockConfig, TerrainVoxel } from '../data/terrain'
import {
  cellsForBrush,
  type EditorBrushState,
} from '../editor/brushCells'
import { WORLD_HALF } from './collision'

export type EditorTool = 'place' | 'erase' | 'paint'

export type EditorPlaceKind = 'terrain' | 'project' | 'light'

export type EraseHoverPayload = {
  terrainKey: string | null
  draftExhibitId: string | null
}

const PREVIEW_INSTANCE_CAP = 4096
const previewBoxGeo = new BoxGeometry(1, 1, 1)
const scratchMat4 = new Matrix4()

type TerrainEditorProps = {
  enabled: boolean
  tool: EditorTool
  color: string
  placeKind: EditorPlaceKind
  brush: EditorBrushState
  terrainVoxels: TerrainVoxel[]
  onTerrainChange: (next: TerrainVoxel[]) => void
  draftExhibits: PortfolioEntry[]
  onDraftExhibitsChange: (next: PortfolioEntry[]) => void
  staticExhibitKeys: Set<string>
  onEraseHover?: (h: EraseHoverPayload) => void
  /** Defaults for newly placed light voxels; paint reapplies to existing lights. */
  lightBlockConfig: LightBlockConfig
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
  brush,
  terrainVoxels,
  onTerrainChange,
  draftExhibits,
  onDraftExhibitsChange,
  staticExhibitKeys,
  onEraseHover,
  lightBlockConfig,
}: TerrainEditorProps) {
  const { gl, camera, scene } = useThree()
  const terrainRef = useRef(terrainVoxels)
  const draftRef = useRef(draftExhibits)
  const staticKeysRef = useRef(staticExhibitKeys)
  const colorRef = useRef(color)
  const lightBlockConfigRef = useRef(lightBlockConfig)
  const hoverEraseRef = useRef(false)
  const hoverPlaceRef = useRef(false)
  const ndcActiveRef = useRef(false)
  const lastEraseSigRef = useRef<string>('|')
  const onEraseHoverRef = useRef(onEraseHover)
  const previewGroupRef = useRef<Group>(null)
  const previewMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    [],
  )
  const previewInstRef = useRef<import('three').InstancedMesh>(null)
  const brushRef = useRef(brush)

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
    lightBlockConfigRef.current = lightBlockConfig
  }, [lightBlockConfig])

  useLayoutEffect(() => {
    brushRef.current = brush
  }, [brush])

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
    const hidePreview = () => {
      if (previewGroup) previewGroup.visible = false
      const im = previewInstRef.current
      if (im) {
        im.count = 0
        im.instanceMatrix.needsUpdate = true
      }
    }

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

    if (!previewGroup) return

    if (!hoverPlaceRef.current || !ndcActiveRef.current) {
      hidePreview()
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
      hidePreview()
      return
    }

    const currentTerrain = terrainRef.current
    const currentDrafts = draftRef.current
    const sk = staticKeysRef.current
    const b = brushRef.current
    const rawCells = cellsForBrush(
      scratchNeighbor.x,
      scratchNeighbor.y,
      scratchNeighbor.z,
      b.shape,
      b,
    )
    const placeable = rawCells.filter(([x, y, z]) => {
      const kk = centerKey(x, y, z)
      if (sk.has(kk)) return false
      if (currentTerrain.some((v) => centerKey(...v.position) === kk))
        return false
      if (currentDrafts.some((e) => centerKey(...e.position) === kk))
        return false
      return true
    })
    const inst = previewInstRef.current
    if (!inst) {
      hidePreview()
      return
    }

    previewColor.set(colorRef.current)
    previewMaterial.color.copy(previewColor)
    previewGroup.position.set(0, 0, 0)

    const n = Math.min(placeable.length, PREVIEW_INSTANCE_CAP)
    if (n === 0) {
      hidePreview()
      return
    }
    inst.count = n
    for (let i = 0; i < n; i++) {
      const [x, y, z] = placeable[i]!
      scratchMat4.makeTranslation(x, y, z)
      inst.setMatrixAt(i, scratchMat4)
    }
    inst.instanceMatrix.needsUpdate = true
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
          const lc = lightBlockConfigRef.current
          onTerrainChange(
            currentTerrain.map((v) => {
              if (centerKey(...v.position) !== pick.terrainKey) return v
              if (v.kind === 'light') {
                return { ...v, color, light: { ...lc } }
              }
              return { ...v, color }
            }),
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
      const [ax, ay, az] = cell
      const br = brushRef.current
      const targets = cellsForBrush(ax, ay, az, br.shape, br)
      if (targets.length === 0) return

      const free = targets.filter(
        ([x, y, z]) => !cellOccupied(x, y, z, currentTerrain, currentDrafts, sk),
      )
      if (free.length === 0) return

      if (placeKind === 'project') {
        const additions = free.map(([x, y, z]) =>
          newDraftExhibit([x, y, z], color),
        )
        onDraftExhibitsChange([...currentDrafts, ...additions])
        return
      }

      const byKey = new Map(
        currentTerrain.map((v) => [centerKey(...v.position), v] as const),
      )
      const lc = lightBlockConfigRef.current
      for (const [x, y, z] of free) {
        const k = centerKey(x, y, z)
        if (placeKind === 'light') {
          byKey.set(k, {
            position: [x, y, z],
            color,
            kind: 'light',
            light: { ...lc },
          })
        } else {
          byKey.set(k, { position: [x, y, z], color })
        }
      }
      onTerrainChange([...byKey.values()])
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
    lightBlockConfig,
    onTerrainChange,
    onDraftExhibitsChange,
    camera,
    gl,
    scene,
  ])

  return (
    <group ref={previewGroupRef} visible={false}>
      <instancedMesh
        ref={previewInstRef}
        args={[previewBoxGeo, previewMaterial, PREVIEW_INSTANCE_CAP]}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  )
}
