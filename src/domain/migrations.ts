// OWNER: T5 — pure, versioned document migrations.
import { SCHEMA_VERSION, type CanvasDocument } from './types'

export class UnsupportedVersionError extends Error {
  readonly version: number
  constructor(version: number) {
    super(`画布数据版本 ${version} 高于当前支持的 ${SCHEMA_VERSION}`)
    this.name = 'UnsupportedVersionError'
    this.version = version
  }
}

type RawDoc = Record<string, unknown> & { version?: number }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * v0 = pre-versioned docs: no `version`, edges without `kind`, possibly missing collections/viewport.
 * Edges leaving a generator are provenance ('result'); everything else was an input.
 */
function v0ToV1(doc: RawDoc): RawDoc {
  const nodes = isRecord(doc.nodes) ? doc.nodes : {}
  const rawEdges = isRecord(doc.edges) ? doc.edges : {}
  const edges: Record<string, unknown> = {}
  for (const [id, e] of Object.entries(rawEdges)) {
    if (!isRecord(e)) continue
    if (e.kind === 'input' || e.kind === 'result') {
      edges[id] = e
      continue
    }
    const src = typeof e.source === 'string' ? nodes[e.source] : undefined
    const fromGenerator = isRecord(src) && src.type === 'generator'
    edges[id] = { ...e, kind: fromGenerator ? 'result' : 'input' }
  }
  const vp = doc.viewport
  const viewport =
    isRecord(vp) && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.zoom === 'number'
      ? vp
      : { x: 0, y: 0, zoom: 1 }
  return {
    ...doc,
    version: 1,
    viewport,
    nodes,
    edges,
    assets: isRecord(doc.assets) ? doc.assets : {},
    tasks: isRecord(doc.tasks) ? doc.tasks : {},
  }
}

/** migrations[n] upgrades a doc from version n to n + 1. */
export const migrations: Record<number, (doc: RawDoc) => RawDoc> = {
  0: v0ToV1,
}

export function migrate(raw: unknown): CanvasDocument {
  if (!isRecord(raw)) throw new Error('画布数据格式无效')
  let doc: RawDoc = { ...raw }
  let version = typeof doc.version === 'number' ? doc.version : 0
  if (version > SCHEMA_VERSION) throw new UnsupportedVersionError(version)
  while (version < SCHEMA_VERSION) {
    const step = migrations[version]
    if (!step) throw new Error(`缺少从版本 ${version} 升级的迁移`)
    doc = step(doc)
    version += 1
  }
  return doc as unknown as CanvasDocument
}
