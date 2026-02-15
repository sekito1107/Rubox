import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IndexSearcher } from '../../../src/reference/index_searcher'

describe('IndexSearcher', () => {
  let searcher: IndexSearcher

  beforeEach(() => {
    searcher = new IndexSearcher()
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('load', () => {
    it('インデックスファイルを正しく読み込めること', async () => {
      const mockIndex = { "each": ["Array#each", "Enumerable#each"] }
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockIndex
      } as Response)

      await searcher.load()
      expect(searcher.findMethod('each')).toEqual(["Array#each", "Enumerable#each"])
    })

    it('エラー時に例外を適切にスローすること', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(searcher.load()).rejects.toThrow('Server returned 404 for rurima_index.json')
    })
  })

  describe('検索', () => {
    const mockIndex = {
      "each": ["Array#each", "Enumerable#each"],
      "map": ["Array#map", "Enumerable#map", "String#map"],
      "open": ["File.open", "IO.open"]
    }

    beforeEach(async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockIndex
      } as Response)
      await searcher.load()
    })

    it('findMethod でメソッド候補を取得できること', () => {
      expect(searcher.findMethod('each')).toEqual(["Array#each", "Enumerable#each"])
      expect(searcher.findMethod('unknown')).toBeNull()
    })

    it('findMethodsByClass でクラスに属するメソッド一覧を取得できること', () => {
      const results = searcher.findMethodsByClass('Array')
      expect(results).toHaveLength(2)
      expect(results[0].methodName).toBe('each')
      expect(results[0].candidates).toContain('Array#each')
      expect(results[1].methodName).toBe('map')
      expect(results[1].candidates).toContain('Array#map')
    })
  })
})
