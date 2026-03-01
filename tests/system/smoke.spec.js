import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
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

    test('基本機能: コード実行と出力クリア', async ({ page }) => {
        // コード実行
        await page.evaluate(() => window.monacoEditor.setValue('puts "Smoke Test"'));
        await page.getByRole('button', { name: 'Run' }).click();
        await expect(page.locator('#terminal-output')).toContainText('Smoke Test');

        // クリア
        await page.getByRole('button', { name: 'Clear' }).click();
        await expect(page.locator('#terminal-output')).not.toContainText('Smoke Test');
    });

    test('基本機能: エラーハンドリング', async ({ page }) => {
        // エラー
        await page.evaluate(() => window.monacoEditor.setValue('undefined_var'));
        await page.getByRole('button', { name: 'Run' }).click();
        await expect(page.locator('#terminal-output')).toContainText('Error:');
    });

    test('UI: メソッドリスト解決', async ({ page }) => {
        // メソッドリスト
        await page.evaluate(() => {
            window.monacoEditor.setValue('puts "test"');
            window.ruboxLSPManager.flushDocumentSync();
        });
        const putsCard = page.locator('#method-list >> [data-role="methodName"]:text-is("puts")').locator('..').locator('..').first();
        await expect(putsCard).toBeVisible({ timeout: 30000 });
        await expect(putsCard.locator('[data-role="className"]')).toHaveText('Kernel');
    });

    test('Ghost Text: 多重代入における診断エラーなしの確認', async ({ page }) => {
        // 多重代入
        const code = 'x, y = [1, 2]';
        await page.evaluate((c) => {
            window.monacoEditor.setValue(c);
            window.ruboxLSPManager.flushDocumentSync();
        }, code);
        await page.waitForTimeout(1000); 

        const diagnostics = await page.evaluate(() => {
            return monaco.editor.getModelMarkers({ owner: "ruby" });
        });
        expect(diagnostics.length).toBe(0);
    });

    test('Ghost Text: Array(range) で型エラーなしの確認', async ({ page }) => {
        const code = [
            'n, k = gets.split.map(&:to_i)',
            'a = Array(1..n)',
            'result = 0',
            'a.each do |i|',
            '  count = 0',
            '  i.times do |j|',
            '    j = j + 1',
            '    break if i + 1 < k',
            '    count += 1 if i % j == 0',
            '  end',
            '  result += 1 if count == k',
            'end',
            'puts result',
        ].join('\n');
        await page.evaluate((c) => {
            window.monacoEditor.setValue(c);
            window.ruboxLSPManager.flushDocumentSync();
        }, code);
        await page.waitForTimeout(2000);

        const diagnostics = await page.evaluate(() =>
            monaco.editor.getModelMarkers({ owner: 'ruby' })
        );
        expect(diagnostics.length).toBe(0);
    });
});
