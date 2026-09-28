// Guards the AGENTS.md rule: src/domain must stay framework/browser-free so it can move to a shared package.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN = /from ['"](react|react-dom|zustand|immer|idb-keyval|motion|@\/(?!domain))/

describe('src/domain purity', () => {
  it('imports nothing from React, stores, browser storage or app layers', () => {
    const dir = join(import.meta.dirname, '..')
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => FORBIDDEN.test(readFileSync(join(dir, f), 'utf8')))
    expect(offenders).toEqual([])
  })
})
