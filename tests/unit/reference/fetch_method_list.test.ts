import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FetchMethodList } from '../../../src/reference/fetch_method_list'

describe('FetchMethodList', () => {
  let fetcher: FetchMethodList
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      sendRequest: vi.fn()
    }
    fetcher = new FetchMethodList(mockClient)
  })

  it('Ruby VM からクラスのメソッド一覧を正しく取得できること', async () => {
    mockClient.sendRequest.mockResolvedValue([
      { methodName: 'each', candidates: ['Array#each', 'Enumerable#each'] }
    ])

    const results = await fetcher.fetch('Array')
    expect(results).toHaveLength(1)
    expect(results[0].methodName).toBe('each')
    expect(results[0].links).toHaveLength(2)
    
    expect(results[0].links[0].signature).toBe('Array#each')
    expect(results[0].links[0].url).toContain('Array/i/each.html')
    
    expect(results[0].links[1].signature).toBe('Enumerable#each')
    expect(results[0].links[1].url).toContain('Enumerable/i/each.html')
  })

  it('メソッドがない場合は空配列を返すこと', async () => {
    mockClient.sendRequest.mockResolvedValue([])
    const results = await fetcher.fetch('NonExistentClass')
    expect(results).toEqual([])
  })

  it('エラー発生時に空配列を返すこと', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockClient.sendRequest.mockRejectedValue(new Error('LSP Error'))
    const results = await fetcher.fetch('Array')
    expect(results).toEqual([])
  })
})
