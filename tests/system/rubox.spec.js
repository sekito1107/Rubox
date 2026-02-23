import { test, expect } from '@playwright/test';

test.describe('Rubox System Integration Tests', () => {
    test('完整なシステムフロー検証', async ({ page, context }) => {
        test.setTimeout(180000); // 3 minutes timeout for the whole flow

        // --- 共通セットアップ ---
        
        // 1. ブラウザログのプロキシ設定
        page.on('console', msg => {
            // "Waiting for ruboxLSPReady" はノイズになるので除外しても良いが、デバッグ用に残す
            if (!msg.text().includes('Waiting for ruboxLSPReady')) {
                console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
            }
        });
        page.on('pageerror', err => {
            console.log(`[Browser PageError] ${err.message}`);
        });

        // 2. クリップボード権限の付与 (Share機能用)
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        // 3. 初期ページロード (これ以降、明示的なリロード以外ではページ遷移しない)
        await test.step('初期化: ページロードとWASM待機', async () => {
            await page.goto('/');
            
            // ターミナルに "Ruby WASM ready!" が表示されるのを待つ (最長90秒)
            await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
            
            // LSP/Monaco/WASM の完全な準備完了を待つカスタムウェイト
            await page.waitForSelector('.monaco-editor');
            await page.evaluate(async () => {
                for (let i = 0; i < 120; i++) { // Max 60sec
                    if (window.ruboxLSPReady) return true;
                    await new Promise(r => setTimeout(r, 500));
                }
                const debug = {
                    lspReady: window.ruboxLSPReady,
                    monaco: !!window.monaco,
                    editor: !!window.monacoEditor,
                    initializing: window.__rubyVMInitializing,
                    ready: window.__rubyVMReady
                };
                throw new Error(`LSP initialization HANG detected. State: ${JSON.stringify(debug)}`);
            });
        });

        // --- 基本機能テスト ---

        await test.step('基本機能: コード実行と出力', async () => {
            await page.evaluate(() => window.monacoEditor.setValue('puts "Hello from WASM!"'));
            await page.getByRole('button', { name: 'Run' }).click();
            await expect(page.locator('#terminal-output')).toContainText('Hello from WASM!', { timeout: 10000 });
        });

        await test.step('基本機能: エラーハンドリング', async () => {
            await page.evaluate(() => window.monacoEditor.setValue('undefined_variable'));
            await page.getByRole('button', { name: 'Run' }).click();
            await expect(page.locator('#terminal-output')).toContainText('Error:', { timeout: 10000 });
        });

        await test.step('基本機能: 出力クリア', async () => {
            await page.getByRole('button', { name: 'Clear' }).click();
            await expect(page.locator('#terminal-output')).not.toContainText('Error:');
            await expect(page.locator('#terminal-output')).not.toContainText('Hello from WASM!');
        });

        // --- Ghost Text (TypeProf) 検証 ---
        // 以前の ghost_text.spec.js の内容

        await test.step('Ghost Text: 長い配列の表示', async () => {
            const code = 'x = (1..20).to_a';
            await setCodeAndSync(page, code);
            
            const result = await measureValue(page, 0, 0, 'x'); // line 0, col 0
            expect(result.length).toBeGreaterThan(50);
            expect(result).toContain('20');
            expect(result).not.toContain('...');
        });

        await test.step('Ghost Text: ループ変数のキャプチャ', async () => {
            const code = [
                'items = [" ruby ", " web-assembly ", " rubox "]',
                'items.each do |item|',
                '  item',
                'end'
            ].join('\n');
            await setCodeAndSync(page, code);

            const result = await measureValue(page, 2, 2, 'item'); // line 2 (3行目)
            expect(result).toContain('" ruby "');
            expect(result).toContain('" web-assembly "');
            expect(result).toContain('" rubox "');
        });

        await test.step('Ghost Text: ミュータブルオブジェクトの追跡', async () => {
            const code = [
                'a = "Ruby"',
                '3.times do',
                '  a << "!"',
                'end'
            ].join('\n');
            await setCodeAndSync(page, code);

            const result = await measureValue(page, 2, 2, 'a');
            expect(result).toContain('"Ruby!"');
            expect(result).toContain('"Ruby!!"');
            expect(result).toContain('"Ruby!!!"');
        });

        await test.step('Ghost Text: 動的配列の多重代入における型推論', async () => {
            const code = [
                'x, y = gets.split.map(&:to_i)',
                'x.times do |i|',
                'end'
            ].join('\n');
            await setCodeAndSync(page, code);

            // 1. 診断（赤線）が出ていないことを確認
            const diagnostics = await page.evaluate(() => {
                return monaco.editor.getModelMarkers({ owner: "ruby" });
            });
            expect(diagnostics.length).toBe(0);
        });

        await test.step('Ghost Text: メソッド内の値キャプチャ', async () => {
            const code = [
                'class DataProcessor',
                '  def self.format(text)',
                '    text.strip.capitalize',
                '  end',
                'end',
                '',
                'DataProcessor.format("ruby")'
            ].join('\n');
            await setCodeAndSync(page, code);

            // メソッド定義行のパラメータ (引数追跡が機能することを確認)
            const resultParams = await measureValue(page, 1, 18, 'text');
            expect(resultParams).toContain('"ruby"');
            
            // メソッド内部の変数 (スコープ分離が機能することを確認)
            const resultInner = await measureValuePromise(page, 2, 4, 'text');
            expect(resultInner).toContain('"ruby"');
        });

        await test.step('Ghost Text: 未来の値が表示されないこと', async () => {
            const code = [
                'string = "Ruby"',
                '5.times do ',
                '  string << "!"',
                'end',
                'string = "reset"'
            ].join('\n');
            await setCodeAndSync(page, code);

            // 1行目の "string" をインスペクト
            const result = await measureValue(page, 0, 0, 'string');
            expect(result).toBe('"Ruby"');
            expect(result).not.toContain('"reset"');
            expect(result).not.toContain('"Ruby!"');
        });

        await test.step('UI: サンプルコードロード', async () => {
            await page.locator('#examples-button').click();
            await page.locator('#examples-menu button[data-key="fizzbuzz"]').click();
            
            await expect.poll(async () => {
                return await page.evaluate(() => window.monacoEditor.getValue());
            }, { timeout: 10000 }).toContain('1.upto(100) do |i|');
        });

        await test.step('UI: メソッドリスト解決', async () => {
            // Kernel#puts
            await setCode(page, 'puts "test"');
            const putsCard = page.locator('#method-list >> [data-role="methodName"]:text-is("puts")').locator('..').locator('..').first();
            await expect(putsCard).toBeVisible({ timeout: 30000 });
            await expect(putsCard.locator('[data-role="className"]')).toHaveText('Kernel');

            // Enumerable#sum
            await setCode(page, '(1..100).sum');
            const sumCard = page.locator('#method-list >> [data-role="methodName"]:text-is("sum")').locator('..').locator('..').first();
            await expect(sumCard).toBeVisible({ timeout: 30000 });

            // Chain resolution: Prime.each.to_a.join
            // Prime は定数なので require 'prime' が必要。LSP同期を待つため少し長めに。
            await setCode(page, "require 'prime'\nPrime.each(10).to_a.join");
            
            // 少し待機（LSPの非同期解析完了待ちコンポーネントがないため）
            await page.waitForTimeout(3000); 

            // each -> Prime
            const eachCard = page.locator('#method-list >> [data-role="methodName"]:text-is("each")').locator('..').locator('..').first();
            await expect(eachCard).toBeVisible({ timeout: 30000 });
            await expect(eachCard.locator('[data-role="className"]')).toHaveText('Prime');
        });

        // --- ファイル操作 & Share ---

        await test.step('機能: ファイルダウンロード', async () => {
             await page.evaluate(() => {
                // @ts-ignore
                window.showSaveFilePicker = undefined;
            });
            const downloadPromise = page.waitForEvent('download');
            await page.getByTitle('コードを保存').click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toBe('rubox.rb');
        });

        await test.step('機能: Shareと復元', async () => {
            const targetCode = 'puts "Share Flow Test"';
            await setCode(page, targetCode);

            await page.getByRole('button', { name: 'Share' }).click();
            await expect(page.locator('#share-modal')).toBeVisible();
            await page.locator('#share-copy-btn').click();
            await expect(page.locator('[data-toast="message"]')).toContainText('クリップボードにコピーしました！');

            // 新しいページを開いて復元確認
            const urlWithHash = await page.evaluate(() => window.location.href);
            const newPage = await context.newPage();
            
            // クリップボードかURLから復元
            if (urlWithHash.includes('#')) {
                await newPage.goto(urlWithHash);
            } else {
                const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
                await newPage.goto(clipboardText);
            }
            // 新しいページでもWASM準備完了を待つ
            await expect(newPage.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
            
            const restoredCode = await newPage.evaluate(() => window.monacoEditor.getValue());
            expect(restoredCode).toBe(targetCode);
            await newPage.close();
        });

        // --- 永続化テスト (リロードを伴うため最後にまとめて実行) ---

        await test.step('永続化: エディタ設定', async () => {
            await page.getByTitle('Editor Settings').click();
            await page.locator('[data-setting="fontSize"]').selectOption('20');
            await page.waitForTimeout(500); // 保存待ち
            await page.getByRole('button', { name: 'Close' }).click();

            await page.reload();
            await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

            await page.getByTitle('Editor Settings').click();
            const fontSize = await page.locator('[data-setting="fontSize"]').inputValue();
            expect(fontSize).toBe('20');
            await page.getByRole('button', { name: 'Close' }).click();
        });

        await test.step('永続化: テーマ', async () => {
            // 現在の状態を取得
            const isDarkInitial = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
            // 切り替え
            await page.getByTitle('テーマ切り替え').click();
            // リロード
            await page.reload();
            await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
            
            const isDarkAfter = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
            expect(isDarkAfter).toBe(!isDarkInitial);
        });

        await test.step('永続化: コード内容', async () => {
             const editedCode = 'puts "Persistence Test"';
             await setCode(page, editedCode);
             await page.waitForTimeout(2000); // Debounce待ち
             
             await page.reload();
             await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
             
             const reloadedCode = await page.evaluate(() => window.monacoEditor.getValue());
             expect(reloadedCode).toBe(editedCode);
        });
    });
});

// --- Helper Functions ---

async function setCode(page, code) {
    await page.evaluate((c) => {
        window.monacoEditor.setValue(c);
    }, code);
}

async function setCodeAndSync(page, code) {
    await page.evaluate((c) => {
        window.monacoEditor.setValue(c);
        window.ruboxLSPManager.flushDocumentSync();
    }, code);
    await page.waitForTimeout(1000); // Analysis wait
}

async function measureValue(page, line, character, expression) {
    return await page.evaluate(async ({ line, character, expression }) => {
        try {
            if (!window.ruboxLSPManager) return "ERROR: No LSP Manager";
            const params = {
                command: "typeprof.measureValue",
                arguments: [{
                    uri: window.monacoEditor.getModel().uri.toString(),
                    line, character, expression
                }]
            };
            return await window.ruboxLSPManager.client.sendRequest("workspace/executeCommand", params);
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    }, { line, character, expression });
}

async function measureValuePromise(page, line, character, expression) {
     return await page.evaluate(async ({ line, character, expression }) => {
        const params = {
                command: "typeprof.measureValue",
                arguments: [{
                    uri: window.monacoEditor.getModel().uri.toString(),
                    line, character, expression
                }]
            };
        // タイムアウト付きレース
        return Promise.race([
            window.ruboxLSPManager.client.sendRequest("workspace/executeCommand", params),
            new Promise(r => setTimeout(() => r("NO_CAPTURE_LOGGED"), 2000))
        ]);
    }, { line, character, expression });
}
