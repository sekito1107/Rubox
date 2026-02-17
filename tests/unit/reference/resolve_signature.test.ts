import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResolveSignature } from '../../../src/reference/resolve_signature'


// LSPClientのモック
const mockLspClient = {
  sendRequest: vi.fn()
}

describe('ResolveSignature', () => {
  let resolver: ResolveSignature

  beforeEach(() => {
    resolver = new ResolveSignature(mockLspClient as any)
    vi.clearAllMocks()
  })

  it('generates /m/ URL for Math module functions', async () => {
    mockLspClient.sendRequest.mockResolvedValue({
      signature: 'Math.sqrt',
      className: 'Math',
      methodName: 'sqrt',
      separator: '.'
    })

    const result = await resolver.resolve('Math', 'sqrt')

    expect(result).not.toBeNull()
    expect(result?.url).toBe('https://docs.ruby-lang.org/ja/latest/method/Math/m/sqrt.html')
  })

  it('generates /m/ URL for Kernel module functions', async () => {
    mockLspClient.sendRequest.mockResolvedValue({
      signature: 'Kernel.puts',
      className: 'Kernel',
      methodName: 'puts',
      separator: '.'
    })

    const result = await resolver.resolve('Kernel', 'puts')
    
    expect(result).not.toBeNull()
    expect(result?.url).toBe('https://docs.ruby-lang.org/ja/latest/method/Kernel/m/puts.html')
  })

  it('generates /s/ URL for File class methods', async () => {
    mockLspClient.sendRequest.mockResolvedValue({
      signature: 'File.open',
      className: 'File',
      methodName: 'open',
      separator: '.'
    })

    const result = await resolver.resolve('File', 'open')

    expect(result).not.toBeNull()
    expect(result?.url).toBe('https://docs.ruby-lang.org/ja/latest/method/File/s/open.html')
  })
})
