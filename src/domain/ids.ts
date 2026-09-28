import { customAlphabet } from 'nanoid'

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)

export type IdPrefix = 'node' | 'edge' | 'asset' | 'task' | 'idem' | 'blob'

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${nano()}`
}
