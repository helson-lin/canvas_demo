import { describe, expect, it } from 'vitest'
import { migrate, migrations, UnsupportedVersionError } from '../migrations'
import { SCHEMA_VERSION } from '../types'

describe('migrate', () => {
  it('has a step for every version below current', () => {
    for (let v = 0; v < SCHEMA_VERSION; v++) expect(migrations[v]).toBeTypeOf('function')
  })

  it('upgrades v0: sets version, defaults edge kind, fills missing collections', () => {
    const doc = migrate({
      nodes: {
        p: { id: 'p', type: 'prompt' },
        g: { id: 'g', type: 'generator' },
        r: { id: 'r', type: 'image' },
      },
      edges: {
        e1: { id: 'e1', source: 'p', target: 'g' },
        e2: { id: 'e2', source: 'g', target: 'r' },
        e3: { id: 'e3', source: 'p', target: 'g', kind: 'input' },
      },
    })
    expect(doc.version).toBe(1)
    expect(doc.edges.e1.kind).toBe('input')
    expect(doc.edges.e2.kind).toBe('result')
    expect(doc.edges.e3.kind).toBe('input')
    expect(doc.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(doc.assets).toEqual({})
    expect(doc.tasks).toEqual({})
  })

  it('keeps current-version docs as-is', () => {
    const raw = { version: SCHEMA_VERSION, viewport: { x: 1, y: 2, zoom: 3 }, nodes: {}, edges: {}, assets: {}, tasks: {} }
    expect(migrate(raw)).toEqual(raw)
  })

  it('does not mutate the input', () => {
    const raw = { edges: { e: { id: 'e', source: 'a', target: 'b' } } }
    migrate(raw)
    expect(raw).toEqual({ edges: { e: { id: 'e', source: 'a', target: 'b' } } })
  })

  it('rejects future versions', () => {
    expect(() => migrate({ version: SCHEMA_VERSION + 1 })).toThrow(UnsupportedVersionError)
  })

  it('rejects non-object input', () => {
    expect(() => migrate(null)).toThrow()
  })
})
