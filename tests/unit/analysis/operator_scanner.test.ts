import { describe, it, expect, beforeEach } from 'vitest'
import { Scanner } from '../../../src/analysis/scanner'

describe('Scanner (Operators)', () => {
  let scanner: Scanner

  beforeEach(() => {
    scanner = new Scanner()
  })

  const createMockModel = (content: string) => ({
    getLineContent: (lineIdx: number) => content.split('\n')[lineIdx - 1],
    getLineCount: () => content.split('\n').length
  })

  describe('operator detection', () => {
    it('中置演算子を正しく抽出できること', () => {
      const code = 'result = n * 2'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      // 期待値: result, n, *
      // 現状では * は検出されないはず
      expect(matches.map(m => m.name)).toContain('*')
    })

    it('演算子の定義を正しく抽出できること', () => {
      const code = 'def +(other)'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      expect(matches[0]).toMatchObject({ name: '+', scanType: 'definition' })
    })

    it('演算子のシンボル形式を正しく抽出できること', () => {
      const code = 'args.reduce(&:+)'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      expect(matches.some(m => m.name === '+' && m.scanType === 'symbol')).toBe(true)
    })

    it('代入演算子と中置演算子を区別すること', () => {
      const code = 'a = 1 + 2'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      // = は除外、+ は抽出
      expect(matches.map(m => m.name)).not.toContain('=')
      const plusMatch = matches.find(m => m.name === '+')
      expect(plusMatch).toBeDefined()
      expect(plusMatch?.scanType).toBe('dot')
    })
    
    it('複数文字の演算子を検出できること', () => {
      const code = 'a << 1'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      expect(matches.map(m => m.name)).toContain('<<')
    })
  })
})
