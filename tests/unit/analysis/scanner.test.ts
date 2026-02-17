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
      expect(line1).toHaveLength(2) // user, name
      expect(line1[0]).toMatchObject({ name: 'user', line: 1 })
      expect(line1[1]).toMatchObject({ name: 'name', line: 1, col: 6 })

      const line2 = results.get(1)!
      expect(line2).toHaveLength(2) // item, price!
      expect(line2[0]).toMatchObject({ name: 'item', line: 2 })
      expect(line2[1]).toMatchObject({ name: 'price!', line: 2, col: 6 })
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
      
      const matches = results.get(0)!
      expect(matches).toHaveLength(3) // items, each, item
      expect(matches[0].name).toBe('items')
      expect(matches[1].name).toBe('each')
      expect(matches[2].name).toBe('item')
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
      
      // if は除外されるが、condition は変数として抽出される
      expect(results.get(0)).toHaveLength(1) 
      expect(results.get(0)![0].name).toBe('condition')

      // def は除外、my_method は抽出
      expect(results.get(1)).toHaveLength(1)
      expect(results.get(1)![0].name).toBe('my_method')

      expect(results.get(2)).toHaveLength(0) // class MyClass -> MyClass (定数は除外)
      expect(results.get(3)).toHaveLength(0) // end
    })

    it('1行に複数のメソッドがある場合を処理できること', () => {
      const code = 'obj.method1.method2(arg)'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      // obj, method1, method2, arg (引数も変数なら抽出される)
      expect(matches).toHaveLength(4)
      expect(matches.map(m => m.name)).toEqual(['obj', 'method1', 'method2', 'arg'])
    })

    it('Symbol#to_proc (&:method) 構文のメソッドを抽出できること', () => {
      const code = 'names.map(&:upcase)\n[1,2,3].select(&:odd?)'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1])

      const line1 = results.get(0)!
      // names, map, upcase
      expect(line1.some(m => m.name === 'names')).toBe(true)
      expect(line1.some(m => m.name === 'map')).toBe(true)
      expect(line1.some(m => m.name === 'upcase')).toBe(true)

      const line2 = results.get(1)!
      expect(line2.some(m => m.name === 'select')).toBe(true)
      expect(line2.some(m => m.name === 'odd?')).toBe(true)
    })


    it('ホワイトリストに含まれる暗黙的なメソッド (puts, p) を抽出できること', () => {
      const code = 'puts "Hello"\np 123'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1])

      const line1 = results.get(0)!
      expect(line1.some(m => m.name === 'puts')).toBe(true)

      const line2 = results.get(1)!
      expect(line2.some(m => m.name === 'p')).toBe(true)
    })

    it('式展開 (#{...}) 内のメソッドを抽出できること', () => {
      const code = '"Hello, #{name.upcase}!"'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])

      const line1 = results.get(0)!
      // name (定数/変数) と upcase (ドット形式) の両方が抽出される可能性がある
      expect(line1.some(m => m.name === 'name')).toBe(true)
      expect(line1.some(m => m.name === 'upcase')).toBe(true)
      const upcaseMatch = line1.find(m => m.name === 'upcase')!
      expect(upcaseMatch.col).toBe(16)
    })

    it('メソッド定義 (def name) を正しく検出できること', () => {
      const code = 'def fib(n)\ndef self.foo\nend'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1])
      
      const line1 = results.get(0)!
      expect(line1.length).toBeGreaterThanOrEqual(1)
      expect(line1[0].name).toBe('fib')
      expect(line1[0].scanType).toBe('definition')

      const line2 = results.get(1)!
      expect(line2).toHaveLength(1)
      expect(line2[0].name).toBe('foo')
      expect(line2[0].scanType).toBe('definition')
    })
    
    it('scanType が正しく判定されること', () => {
      const code = 'name\nobj.method\nfunc()\n&:sym'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0, 1, 2, 3])

      expect(results.get(0)![0].scanType).toBe('bare')
      expect(results.get(1)![0].scanType).toBe('bare') // obj
      expect(results.get(1)![1].scanType).toBe('dot')  // method
      expect(results.get(2)![0].scanType).toBe('call') // func
      expect(results.get(3)![0].scanType).toBe('symbol') // sym
    })

    it('変数代入とメソッド呼び出しが混在する場合 (sum = (1..100).sum) のscanTypeを正しく判定すること', () => {
      const code = 'sum = (1..100).sum'
      const model = createMockModel(code)
      const results = scanner.scanLines(model, [0])
      
      const matches = results.get(0)!
      expect(matches).toHaveLength(2)
      
      // 1. sum (変数: bare)
      expect(matches[0].name).toBe('sum')
      expect(matches[0].scanType).toBe('bare')

      // 2. .sum (メソッド: dot)
      expect(matches[1].name).toBe('sum')
      expect(matches[1].scanType).toBe('dot')
    })

    describe('カラム位置の正確性テスト', () => {
      it('様々な開始位置で正確にカラムを特定できること', () => {
        const scenarios = [
          { code: 'puts hello', name: 'puts', col: 1 },
          { code: '  p 123', name: 'p', col: 3 },
          { code: 'obj.method', name: 'method', col: 5 },
          { code: 'obj.method!', name: 'method!', col: 5 },
          { code: 'obj.query?', name: 'query?', col: 5 },
          { code: 'calculate(1, 2)', name: 'calculate', col: 1 },
          { code: '  calculate { }', name: 'calculate', col: 3 },
          { code: 'items.map(&:upcase)', name: 'upcase', col: 13 },
          { code: '  &:to_s', name: 'to_s', col: 5 },
          { code: '"#{p 1}"', name: 'p', col: 4 }
        ]

        scenarios.forEach(({ code, name, col }) => {
          const model = createMockModel(code)
          const results = scanner.scanLines(model, [0])
          const match = results.get(0)!.find(m => m.name === name)
          
          if (!match) {
            console.log(`Debug results for [${code}]:`, results.get(0))
          }
          expect(match, `Failed to find [${name}] in [${code}]`).toBeDefined()
          expect(match!.col, `Incorrect column for [${name}] in [${code}]`).toBe(col)
        })
      })

      it('式展開が複数ある場合も正しく位置を特定できること', () => {
        const code = '"#{a.first}: #{b.last}"'
        const model = createMockModel(code)
        const results = scanner.scanLines(model, [0])
        const matches = results.get(0)!

        expect(matches).toHaveLength(4) 
        expect(matches[0]).toMatchObject({ name: 'a', col: 4 }) // a position
        expect(matches[1]).toMatchObject({ name: 'first', col: 6 })
        expect(matches[2]).toMatchObject({ name: 'b', col: 16 })
        expect(matches[3]).toMatchObject({ name: 'last', col: 18 })
      })

      it('単語の途中 (Sum(等) から意図しないマッチ (um) が発生しないこと', () => {
        const code = 'puts "Sum (1..100): #{sum}"'
        const model = createMockModel(code)
        const results = scanner.scanLines(model, [0])
        const matches = results.get(0)!

        // puts と sum (ホワイトリストに含まれる場合のみ) が抽出されるはず
        // 'um' が Group 2 などで誤認されないことを確認
        expect(matches.map(m => m.name)).not.toContain('um')
      })
    })
  })
})
