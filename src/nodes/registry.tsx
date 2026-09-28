// OWNER: T2 — maps node type to component.
import type { CanvasNode } from '@/domain'
import { GeneratorNode } from './GeneratorNode'
import { ImageNode } from './ImageNode'
import { PromptNode } from './PromptNode'

export function renderNode(node: CanvasNode) {
  switch (node.type) {
    case 'image':
      return <ImageNode key={node.id} node={node} />
    case 'prompt':
      return <PromptNode key={node.id} node={node} />
    case 'generator':
      return <GeneratorNode key={node.id} node={node} />
  }
}
