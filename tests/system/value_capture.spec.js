import { test, expect } from '@playwright/test';

test.describe('値キャプチャ統合テスト (一括検証)', () => {
    test.setTimeout(120000);
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
        await page.waitForSelector('.monaco-editor');
        await page.evaluate(async () => {
            for (let i = 0; i < 60; i++) {
                if (window.ruboxLSPReady) return true;
                await new Promise(r => setTimeout(r, 500));
            }
        });
    });

    const executionCases = [
        // --- スコープ ---
        {
            name: 'スコープ: トップレベル vs メソッド',
            code: 'target = "banana"\ndef my_count\n  target = "apple"\n  target\nend\nmy_count',
            line: 3, expr: 'target', expected: '"apple"'
        },
        {
            name: 'スコープ: メソッド引数の独立性',
            code: 'target = "banana"\ndef my_count(target)\n  target\nend\nmy_count("apple")',
            line: 0, expr: 'target', expected: '"banana"'
        },
        {
            name: 'スコープ: メソッド内のローカル変数',
            code: 'def my_method\n  x = 10\n  x\nend\nmy_method',
            line: 2, expr: 'x', expected: '10'
        },
        {
            name: 'スコープ: クラスメソッドのキャプチャ',
            code: 'class MyClass\n  def self.greet\n    v = " ruby "\n    v\n  end\nend\nMyClass.greet',
            line: 3, expr: 'v', expected: '" ruby "'
        },

        // --- ループと破壊的変更 ---
        {
            name: 'ループ: 単純なインクリメント',
            code: 'a = 0\n3.times do |i|\n  a += 1\nend',
            line: 2, expr: 'a', expected: '1, 2, 3'
        },
        {
            name: 'ループ: ブロック内での破壊的変更',
            code: 'a = []\n3.times do |i|\n  a << [1].map { |n| n }\nend',
            line: 2, expr: 'a', expected: '[[1]], [[1], [1]], [[1], [1], [1]]'
        },
        {
            name: 'ループ: 1行ループ',
            code: 'a = []; 3.times { a << [1] }',
            line: 0, expr: 'a << [1]', expected: '[[1]], [[1], [1]], [[1], [1], [1]]'
        },
        {
            name: 'ループ: コレクションの各要素',
            code: 'items = ["a", "b"]\nitems.each do |item|\n  item\nend',
            line: 2, expr: 'item', expected: '"a", "b"'
        },
        {
            name: 'ループ: 破壊的変更の追跡',
            code: 'a = "R"\n3.times do\n  a << "!"\nend',
            line: 2, expr: 'a', expected: '"R!", "R!!", "R!!!"'
        },
        {
            name: 'リグレッション: 複数行のネスト',
            code: 'a = []\n3.times do |i|\n  a << [i]\nend',
            line: 2, expr: 'a << [i]', expected: '[[0]], [[0], [1]], [[0], [1], [2]]'
        },

        // --- タイミングとフィルタリング ---
        {
            name: 'タイミング: 未来の値のキャプチャ防止',
            code: 's = "R"\n5.times { s << "!" }\ns = "reset"',
            line: 0, expr: 's', expected: '"R"'
        },
        {
            name: 'タイミング: 再代入時は新しい値のみ表示',
            code: 's = "R"\n5.times { s << "!" }\nputs s\ns = "nil"\nputs s',
            line: 4, expr: 's', expected: '"nil"'
        },
        {
            name: 'タイミング: puts呼び出し時の現在値',
            code: 's = "R"\n3.times { s << "!" }\nputs s\ns = "reset"',
            line: 2, expr: 's', expected: '"R!!!"'
        },
        {
            name: 'フィルタリング: 中間的なnilを除外',
            code: 'targets = ["a", "bb"]\nmax = targets.max_by{|t| t.size}.size',
            line: 1, expr: 'max', expected: '2'
        },

        // --- その他 ---
        {
            name: 'その他: メソッドチェーン',
            code: 't = "abc"\nt.each_char',
            line: 1, expr: 't.each_char', expected: '/#<Enumerator: "abc":each_char>/'
        },
        {
            name: 'その他: 長い配列（省略なし）',
            code: 'x = (1..20).to_a',
            line: 0, expr: 'x', expected: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]'
        }
    ];

    test('コア実行ロジック: 一括検証', async ({ page }) => {
        for (const c of executionCases) {
            await test.step(`Case: ${c.name}`, async () => {
                await setCodeAndSync(page, c.code);
                const result = await measureValue(page, c.line, c.col || 0, c.expr);
                
                if (c.expected instanceof RegExp || (typeof c.expected === 'string' && c.expected.startsWith('/'))) {
                    const pattern = c.expected instanceof RegExp ? c.expected : new RegExp(c.expected.slice(1, -1));
                    expect(result).toMatch(pattern);
                } else {
                    expect(result).toBe(c.expected);
                }
            });
        }
    });

    test('IOロジック: gets と split', async ({ page }) => {
        // gets
        await setCodeAndSync(page, 'x = gets');
        const res1 = await measureValue(page, 0, 0, 'x', 'hello\n');
        expect(res1).toBe('"hello\\n"');

        // gets split multi-assign
        await setCodeAndSync(page, 'x, y = gets.split.map(&:to_i)');
        const res2 = await measureValue(page, 0, 0, 'x, y = gets.split.map(&:to_i)', '10 20\n');
        // sanitize により [x, y] が評価される
        expect(res2).toBe('[10, 20]');
    });
});

// --- Helpers ---

async function setCodeAndSync(page, code) {
    await page.evaluate((c) => {
        window.monacoEditor.setValue(c);
        window.ruboxLSPManager.flushDocumentSync();
    }, code);
    await page.waitForTimeout(500); 
}

async function measureValue(page, line, character, expression, stdin = "") {
    return await page.evaluate(async ({ line, character, expression, stdin }) => {
        const params = {
            command: "typeprof.measureValue",
            arguments: [{
                uri: window.monacoEditor.getModel().uri.toString(),
                line, character, expression, stdin,
                code: window.monacoEditor.getValue()
            }]
        };
        return await window.ruboxLSPManager.client.sendRequest("workspace/executeCommand", params);
    }, { line, character, expression, stdin });
}
