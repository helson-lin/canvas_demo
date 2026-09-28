// OWNER: T4 — deterministic failure switches and timings for the mock service.
export interface MockConfig {
  failNext: boolean
  failAll: boolean
  queueMs: number
  runMs: number
}

export const mockConfig: MockConfig = { failNext: false, failAll: false, queueMs: 800, runMs: 2500 }
