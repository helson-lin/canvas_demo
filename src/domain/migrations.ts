// OWNER: T5 — T0 provides the framework; T5 adds tests and real migrations.
import { SCHEMA_VERSION, type CanvasDocument } from './types'

export class UnsupportedVersionError extends Error {
  readonly version: number
  constructor(version: number) {
    super(`画布数据版本 ${version} 高于当前支持的 ${SCHEMA_VERSION}`)
    this.version = version
  }
}

type RawDoc = Record<string, unknown> & { version?: number }

/** migrations[n] upgrades a doc from version n to n + 1. */
export const migrations: Record<number, (doc: RawDoc) => RawDoc> = {
  0: (doc) => ({ ...doc, version: 1 }),
}

export function migrate(raw: unknown): CanvasDocument {
  let doc = { ...(raw as RawDoc) }
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
