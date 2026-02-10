import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResolveSignature } from '../../../src/reference/resolve_signature'
import { IndexSearcher } from '../../../src/reference/index_searcher'

describe('ResolveSignature', () => {
  let resolver: ResolveSignature
  let searcher: IndexSearcher

  beforeEach(() => {
    searcher = new IndexSearcher()
    resolver = new ResolveSignature(searcher)
  })

  it('自クラスのメソッドを優先して解決できること', () => {
    vi.spyOn(searcher, 'findMethod').mockReturnValue(['Array#each', 'Enumerable#each'])
    
    const result = resolver.resolve('Array', 'each')
    expect(result?.signature).toBe('Array#each')
    expect(result?.className).toBe('Array')
  })

  it('自クラスにない場合、継承チェーンに従って解決できること', () => {
    // Array は map を持っているが、仮に Enumerable にしかない場合を想定
    vi.spyOn(searcher, 'findMethod').mockReturnValue(['Enumerable#map'])
    
    const result = resolver.resolve('Array', 'map')
    expect(result?.signature).toBe('Enumerable#map')
    expect(result?.className).toBe('Enumerable')
  })

  it('Object などの基底クラスのメソッドも解決できること', () => {
    vi.spyOn(searcher, 'findMethod').mockReturnValue(['Object#to_s', 'Kernel#to_s'])
    
    const result = resolver.resolve('String', 'to_s')
    expect(result?.signature).toBe('Object#to_s')
  })

  it('継承チェーンに一致する候補がない場合は null を返すこと', () => {
    vi.spyOn(searcher, 'findMethod').mockReturnValue(['JSON.parse'])
    
    const result = resolver.resolve('String', 'parse')
    expect(result).toBeNull()
  })

  it('未知のクラスでもデフォルトの継承チェーン（Object起点）で解決を試みること', () => {
    vi.spyOn(searcher, 'findMethod').mockReturnValue(['Object#class'])
    
    const result = resolver.resolve('UnknownClass', 'class')
    expect(result?.signature).toBe('Object#class')
  })
})
