// Static import-cycle guard. Vitest's transform resolves imports lazily, so a runtime test can't reproduce
// the TDZ crash a cycle causes in the browser (seen with persist.ts <-> taskRunner.ts). Dynamic import() is allowed.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(import.meta.dirname, '..')
const EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'test' ? [] : files(p)
    return /\.tsx?$/.test(name) ? [p] : []
  })
}

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null
  for (const ext of ['', ...EXTS]) {
    try {
      if (statSync(base + ext).isFile()) return base + ext
    } catch {
      /* try next */
    }
  }
  return null
}

function staticImports(file: string): string[] {
  const code = readFileSync(file, 'utf8')
  const specs = [...code.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
  return specs.map((s) => resolveSpec(file, s)).filter((p): p is string => !!p)
}

describe('module graph', () => {
  it('has no static import cycles in src', () => {
    const graph = new Map(files(SRC).map((f) => [f, staticImports(f)]))
    const cycles: string[] = []
    const state = new Map<string, 'visiting' | 'done'>()
    const stack: string[] = []
    const visit = (f: string) => {
      if (state.get(f) === 'done') return
      if (state.get(f) === 'visiting') {
        cycles.push([...stack.slice(stack.indexOf(f)), f].map((p) => relative(SRC, p)).join(' -> '))
        return
      }
      state.set(f, 'visiting')
      stack.push(f)
      for (const dep of graph.get(f) ?? []) visit(dep)
      stack.pop()
      state.set(f, 'done')
    }
    for (const f of graph.keys()) visit(f)
    expect(cycles).toEqual([])
  })
})
