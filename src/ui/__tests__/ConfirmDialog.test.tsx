import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { confirm } from '@/ui/confirm'

describe('ConfirmDialog', () => {
  it('shows the pending request and resolves with the chosen button', async () => {
    render(<ConfirmDialog />)
    let result!: Promise<boolean>
    act(() => {
      result = confirm({ title: '删除该节点？', description: '将删除所选节点及其 1 条连线。', confirmLabel: '删除', destructive: true })
    })
    expect(await screen.findByText('删除该节点？')).toBeTruthy()
    expect(screen.getByText('将删除所选节点及其 1 条连线。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(await result).toBe(true)
  })

  it('cancel resolves false', async () => {
    render(<ConfirmDialog />)
    let result!: Promise<boolean>
    act(() => {
      result = confirm({ title: '删除 2 个节点？', confirmLabel: '删除' })
    })
    fireEvent.click(await screen.findByRole('button', { name: '取消' }))
    expect(await result).toBe(false)
  })
})
