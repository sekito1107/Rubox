import { test, expect } from '@playwright/test';

test.describe('セキュリティ機能検証', () => {
    test('CSP設定の確認', async ({ page }) => {
        await page.goto('/');
        const cspMeta = page.locator('meta[http-equiv="Content-Security-Policy"]');
        await expect(cspMeta).toHaveCount(1);
        const content = await cspMeta.getAttribute('content');
        
        expect(content).toContain("default-src 'self'");
        expect(content).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
        expect(content).toContain("connect-src 'self'");
        expect(content).toContain("worker-src 'self'");
    });

    test('共有リンク警告の表示', async ({ page, context }) => {
        // 1. UI経由で共有リンクを生成
        await page.goto('/');
        
        // エディタの準備完了を待つ
        await page.waitForSelector('.monaco-editor');
        
        // コードを入力
        await page.evaluate(() => window.monacoEditor.setValue('puts "Security Test"'));
        
        // Shareボタンをクリック
        await page.getByRole('button', { name: 'Share' }).click();
        await expect(page.locator('#share-modal')).toBeVisible();
        
        // 生成されたURLを取得
        const sharedUrl = await page.inputValue('#share-preview');
        expect(sharedUrl).toContain('#code=');

        // 2. 新しいページで共有リンクを開く
        const newPage = await context.newPage();
        await newPage.goto(sharedUrl);
        
        // 3. 警告トーストを確認
        // トーストが表示されるのを待つ
        const toastMessage = newPage.locator('[data-toast="message"]');
        
        await expect(toastMessage).toBeVisible({ timeout: 15000 });
        await expect(toastMessage).toContainText('共有されたコードです');
        await expect(toastMessage).toContainText('確認してください');

        // 警告アイコンを確認
        const warningIcon = newPage.locator('[data-toast="icon"] svg[data-type="warning"]');
        await expect(warningIcon).toBeVisible();
        await expect(warningIcon).not.toHaveClass(/hidden/);
        
        // コードが実際に読み込まれているか確認
        // エディタの値が反映されるのを待つ
        await expect.poll(async () => {
             return await newPage.evaluate(() => window.monacoEditor ? window.monacoEditor.getValue() : "");
        }, { timeout: 10000 }).toBe('puts "Security Test"');

        await newPage.close();
    });
});
