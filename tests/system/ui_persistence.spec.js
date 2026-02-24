import { test, expect } from '@playwright/test';

test.describe('UI and Persistence Tests', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto('/');
        await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
        await page.waitForSelector('.monaco-editor');
    });

    test('UI: サンプルコードロード', async ({ page }) => {
        // Examples
        await page.locator('#examples-button').click();
        await page.locator('#examples-menu button[data-key="fizzbuzz"]').click();
        
        await expect.poll(async () => {
            return await page.evaluate(() => window.monacoEditor.getValue());
        }, { timeout: 10000 }).toContain('1.upto(100) do |i|');
    });

    test('機能: ファイルダウンロード', async ({ page }) => {
        // Download
        await page.evaluate(() => {
            // @ts-ignore
            window.showSaveFilePicker = undefined;
        });
        const downloadPromise = page.waitForEvent('download');
        await page.getByTitle('コードを保存').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('rubox.rb');
    });

    test('機能: Shareと復元', async ({ page, context }) => {
        // Share
        const targetCode = 'puts "Share Persistence Test"';
        await page.evaluate((c) => window.monacoEditor.setValue(c), targetCode);

        await page.getByRole('button', { name: 'Share' }).click();
        await expect(page.locator('#share-modal')).toBeVisible();
        await page.locator('#share-copy-btn').click();
        
        const urlWithHash = await page.evaluate(() => window.location.href);
        const newPage = await context.newPage();
        
        await newPage.goto(urlWithHash);
        await expect(newPage.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
        
        const restoredCode = await newPage.evaluate(() => window.monacoEditor.getValue());
        expect(restoredCode).toBe(targetCode);
        await newPage.close();
    });

    test('永続化: エディタ設定・テーマ・コード', async ({ page }) => {
        // エディタ設定・テーマ・コードの永続化検証（効率化のため）
        
        // 1. 設定変更
        await page.getByTitle('Editor Settings').click();
        await page.locator('[data-setting="fontSize"]').selectOption('22');
        await page.waitForTimeout(500); 
        await page.getByRole('button', { name: 'Close' }).click();

        // 2. テーマ変更
        const isDarkInitial = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
        await page.getByTitle('テーマ切り替え').click();

        // 3. コード編集
        const editedCode = 'puts "Persistence Layer Test"';
        await page.evaluate((c) => window.monacoEditor.setValue(c), editedCode);
        await page.waitForTimeout(2000); // Debounce wait

        // 4. リロード
        await page.reload();
        await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

        // 5. 検証
        // FontSize
        await page.getByTitle('Editor Settings').click();
        expect(await page.locator('[data-setting="fontSize"]').inputValue()).toBe('22');
        await page.getByRole('button', { name: 'Close' }).click();

        // Theme
        const isDarkAfter = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
        expect(isDarkAfter).toBe(!isDarkInitial);

        // Code
        expect(await page.evaluate(() => window.monacoEditor.getValue())).toBe(editedCode);
    });
});
