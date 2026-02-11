import { describe, it, expect, beforeEach } from 'vitest'
import { Scanner } from '../../../src/analysis/scanner'

describe('Scanner', () => {
  let scanner: Scanner

  beforeEach(() => {
    scanner = new Scanner()
  })

  // Monaco のモデルをモック化
  const createMockModel = (content: string) => ({
    getLineContent: (lineIdx: number) => content.split('\n')[lineIdx - 1],
    getLineCount: () => content.split('\n').length
  })

  describe('scanLines', () => {
    it('ドット記法のメソッドを正しく抽出できること', () => {
      const code = 'user.name\nitem.price!'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1])
      
      const line1 = results.get(0)!
      expect(line1).toHaveLength(1)
      expect(line1[0]).toMatchObject({ name: 'name', line: 1, col: 6 })

      const line2 = results.get(1)!
      expect(line2).toHaveLength(1)
      expect(line2[0]).toMatchObject({ name: 'price!', line: 2, col: 6 })
    })

    it('括弧付きのメソッド呼び出しを抽出できること', () => {
      const code = 'calculate(10)\n  format { |x| x }'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1])
      
      expect(results.get(0)![0].name).toBe('calculate')
      expect(results.get(1)![0].name).toBe('format')
    })

    it('doブロック付きのメソッドを抽出できること', () => {
      const code = 'items.each do |item|'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      expect(results.get(0)![0].name).toBe('each')
    })

    it('コメントアウトされた行のメソッドを無視し、インデックスを維持すること', () => {
      const code = 'method1() # some.method2\n# comment.method3()\nmethod4 do\nend'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1, 2])
      
      // Line 1: method1のみ
      expect(results.get(0)).toHaveLength(1)
      expect(results.get(0)![0].name).toBe('method1')
      
      // Line 2: なし
      expect(results.get(1)).toHaveLength(0)
      
      // Line 3: method4
      expect(results.get(2)![0].name).toBe('method4')
    })

    it('ブラックリストに含まれるキーワードを除外すること', () => {
      const code = 'if condition\ndef my_method\nclass MyClass\nend'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1, 2, 3])
      
      expect(results.get(0)).toHaveLength(0) // if
      expect(results.get(1)).toHaveLength(0) // def
      expect(results.get(2)).toHaveLength(0) // class
      expect(results.get(3)).toHaveLength(0) // end
    })

    it('1行に複数のメソッドがある場合を処理できること', () => {
      const code = 'obj.method1.method2(arg)'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      expect(matches).toHaveLength(2)
      expect(matches[0].name).toBe('method1')
      expect(matches[1].name).toBe('method2')
    })

    it('Symbol#to_proc (&:method) 構文のメソッドを抽出できること', () => {
      const code = 'names.map(&:upcase)\n[1,2,3].select(&:odd?)'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1])

      const line1 = results.get(0)!
      expect(line1.some(m => m.name === 'map')).toBe(true)
      expect(line1.some(m => m.name === 'upcase')).toBe(true)

      const line2 = results.get(1)!
      expect(line2.some(m => m.name === 'select')).toBe(true)
      expect(line2.some(m => m.name === 'odd?')).toBe(true)
    })
  })
})
