import type { AspectRatio } from './types'

export interface SampleImage {
  id: string
  label: string
  url: string
  aspectRatio: AspectRatio
  width: number
  height: number
}

export const SAMPLE_IMAGES: SampleImage[] = [
  { id: 'sample-square', label: '示例 1:1', url: '/samples/square.svg', aspectRatio: '1:1', width: 512, height: 512 },
  { id: 'sample-wide', label: '示例 16:9', url: '/samples/wide.svg', aspectRatio: '16:9', width: 768, height: 432 },
  { id: 'sample-tall', label: '示例 9:16', url: '/samples/tall.svg', aspectRatio: '9:16', width: 432, height: 768 },
]

/** Fixed mock outputs per aspect ratio (allowed by the brief; each run still creates a new Asset). */
export const MOCK_OUTPUTS: Record<AspectRatio, { url: string; width: number; height: number }> = {
  '1:1': { url: '/samples/result-square.svg', width: 512, height: 512 },
  '16:9': { url: '/samples/result-wide.svg', width: 768, height: 432 },
  '9:16': { url: '/samples/result-tall.svg', width: 432, height: 768 },
}
