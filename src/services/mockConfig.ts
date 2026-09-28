// OWNER: T4 (logic) — contract used by C2 DevPanel. Deterministic failure switches and timings.
export interface MockConfig {
  failNext: boolean
  failAll: boolean
  queueMs: number
  runMs: number
}

let config: MockConfig = { failNext: false, failAll: false, queueMs: 800, runMs: 2500 }
const listeners = new Set<() => void>()

export function getMockConfig(): MockConfig {
  return config
}

export function setMockConfig(patch: Partial<MockConfig>): void {
  config = { ...config, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeMockConfig(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
