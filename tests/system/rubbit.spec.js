import { test, expect } from '@playwright/test';

test.describe('Rubbit E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));
    page.on('requestfailed', req => console.log(`[Browser RequestFailed] ${req.url()} - ${req.failure().errorText}`));
    await page.goto('/');
  });

  test('Rubyコードを実行して結果を表示する', async ({ page }) => {
    // Ruby WASM の初期化を待機（ターミナルの出力を確認）
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    // エディタにコードをセット
    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue('puts "Hello from WASM!"');
      }
    });

    // Runボタンをクリック
    await page.getByRole('button', { name: 'Run' }).click();

    // 出力がターミナルに表示されることを検証
    await expect(page.locator('#terminal-output')).toContainText('Hello from WASM!', { timeout: 10000 });
  });

  test('Rubyのエラーを適切にハンドリングする', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue('undefined_variable');
      }
    });

    await page.getByRole('button', { name: 'Run' }).click();

    await expect(page.locator('#terminal-output')).toContainText('Error:', { timeout: 10000 });
  });

  test('ターミナルの出力をクリアする', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.locator('body')).not.toContainText('Ruby WASM ready!');
  });

  test('ShareボタンでコードをURLに保存・復元できる', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    const targetCode = 'puts "Share Flow Test"';
    await page.evaluate((code) => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue(code);
      }
    }, targetCode);

    // Shareボタンをクリック (モーダルが開く)
    await page.getByRole('button', { name: 'Share' }).click();

    // モーダルが表示されるのを待つ
    await expect(page.locator('#share-modal')).toBeVisible();

    // Copyボタンをクリック
    await page.locator('#share-copy-btn').click();

    // 通知を確認
    await expect(page.locator('[data-toast="message"]')).toContainText('Copied to clipboard!', { timeout: 10000 });

    // URLハッシュから共有URLを取得 (history.replaceState で更新されていることを期待)
    const urlWithHash = await page.evaluate(() => window.location.href);

    // 新しいページで共有URLを開く
    const newPage = await context.newPage();
    
    if (urlWithHash.includes('#')) {
         await newPage.goto(urlWithHash);
    } else {
         // URLが更新されていない場合はクリップボードから取得（フォールバック）
         const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
         await newPage.goto(clipboardText);
    }
    
    await expect(newPage.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    // コードが復元されているか確認
    const restoredCode = await newPage.evaluate(() => {
      const editor = window.monacoEditor;
      return editor ? editor.getValue() : "";
    });
    expect(restoredCode).toBe(targetCode);
  });

  test('ファイルをダウンロードできる', async ({ page }) => {
    // showSaveFilePicker を削除して、レガシーダウンロードへのフォールバックを強制する
    await page.evaluate(() => {
        // @ts-ignore
        window.showSaveFilePicker = undefined;
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTitle('コードを保存').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('rubbit.rb');
    await download.path();
  });

  test('編集内容がlocalStorageに保存され永続化される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    const editedCode = 'puts "Persistence Test"';
    await page.evaluate((code) => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue(code);
      }
    }, editedCode);

    // Debounceを待つために少し待機
    await page.waitForTimeout(2000);

    // リロード
    await page.reload();
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    const reloadedCode = await page.evaluate(() => {
      const editor = window.monacoEditor;
      return editor ? editor.getValue() : "";
    });
    expect(reloadedCode).toBe(editedCode);
  });

  test('エディタ設定を変更して永続化される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    // 設定モーダルを開く
    await page.getByTitle('Editor Settings').click();

    // フォントサイズを変更 (14px -> 20px)
    await page.locator('[data-setting="fontSize"]').selectOption('20');
    
    // 設定が反映されるのを待つ (イベント発火待ち)
    await page.waitForTimeout(500);

    // モーダルを閉じる
    await page.getByRole('button', { name: 'Close' }).click();

    // リロード
    await page.reload();
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    // 設定モーダルを再度開く
    await page.getByTitle('Editor Settings').click();

    // フォントサイズが維持されているか確認
    const fontSize = await page.locator('[data-setting="fontSize"]').inputValue();
    expect(fontSize).toBe('20');
  });

  test('テーマを切り替えて永続化される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.getByTitle('テーマ切り替え').click();

    const isDark = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
    
    // リロード
    await page.reload();
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const isDarkAfter = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
    expect(isDarkAfter).toBe(isDark);
  });

  test('サンプルコードをロードできる', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.locator('#examples-button').click(); // Examplesボタン
    await page.locator('#examples-menu button[data-key="fizzbuzz"]').click();
    
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const editor = window.monacoEditor;
        return editor ? editor.getValue() : "";
      });
    }, { timeout: 10000 }).toContain('1.upto(100) do |i|');
  });
  
  test('右側パネルでメソッドが正しく解決され表示される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });

    // 1. 標準的なクラスのメソッド (puts)
    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) editor.setValue('puts "test"');
    });

    // 右側パネルに Kernel#puts が表示されるのを待つ
    // data-role="methodName" が "puts" である最初のカードを探す
    const putsCard = page.locator('#method-list >> [data-role="methodName"]:text-is("puts")').locator('..').locator('..').first();
    await expect(putsCard).toBeVisible({ timeout: 10000 });
    await expect(putsCard.locator('[data-role="className"]')).toHaveText('Kernel');
    await expect(putsCard.locator('[data-role="separatorMethod"]')).toHaveText('#puts');

    // 3. 継承されたメソッド ((1..100).sum -> Enumerable#sum)
    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) editor.setValue('(1..100).sum');
    });

    // 右側パネルに Enumerable#sum が表示されるのを待つ
    const sumCard = page.locator('#method-list >> [data-role="methodName"]:text-is("sum")').locator('..').locator('..').first();
    await expect(sumCard).toBeVisible({ timeout: 15000 });
    await expect(sumCard.locator('[data-role="className"]')).toHaveText('Enumerable');
    await expect(sumCard.locator('[data-role="separatorMethod"]')).toHaveText('#sum');
  });

});
