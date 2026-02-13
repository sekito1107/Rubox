import { test, expect } from '@playwright/test';


test.describe('Ghost Text Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 解析終了を待つ
    await page.waitForSelector('.monaco-editor');
    // カスタムイベントを待機して準備完了を確認
    await page.evaluate(async () => {
      for (let i = 0; i < 180; i++) {
        if (window.rubbitLSPReady) return true;
        await new Promise(r => setTimeout(r, 500));
        if (i % 10 === 0) console.log(`Waiting for rubbitLSPReady... i=${i}`);
      }
      throw new Error("Timeout waiting for rubbitLSPReady");
    });
  });

  test('長い配列の結果が切り詰められずに表示されること', async ({ page }) => {
    const code = 'x = (1..20).to_a';
    await page.evaluate((c) => {
      window.monacoEditor.setValue(c);
      window.rubbitLSPManager.flushDocumentSync();
    }, code);

    // 解析を待つ
    await page.waitForTimeout(1000);

    // 1行目の x を計測
    const result = await page.evaluate(async () => {
      try {
        // monaco が window に公開されている前提
        if (!window.monaco || !window.monaco.editor) {
            return "ERROR: window.monaco.editor is not defined";
        }
        

        if (!window.rubbitLSPManager) {
            return "ERROR: rubbitLSPManager is not defined";
        }
        
        const params = {
            command: "typeprof.measureValue",
            arguments: [{
                uri: window.monacoEditor.getModel().uri.toString(),
                line: 0,
                character: 0,
                expression: "x"
            }]
        };
        
        // LSPクライアントのメソッドを直接呼ぶ
        const result = await window.rubbitLSPManager.client.sendRequest("workspace/executeCommand", params);
        console.log("DEBUG: measureValue result =", result);
        return result;

      } catch (e) {
        console.log("ERROR: measureValue threw:", e.toString());
        return "ERROR: " + e.toString();
      }
    });

    expect(result.length).toBeGreaterThan(50);
    expect(result).toContain('20');
    expect(result).not.toContain('...');
  });


  test('ループ内の変数が正しくキャプチャされること', async ({ page }) => {
    // ライン番号を明確にするため結合文字列を使用
    const code = [
      'items = [" ruby ", " web-assembly ", " rubbit "]',
      'items.each do |item|',
      '  item',
      'end'
    ].join('\n');
    
    await page.evaluate((c) => {
      window.monacoEditor.setValue(c);
      window.rubbitLSPManager.flushDocumentSync();
    }, code);

    // 解析を待つ
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      if (!window.rubbitLSPManager) return "ERROR: rubbitLSPManager is not defined";
      
      const params = {
        command: "typeprof.measureValue",
        arguments: [{
          uri: window.monacoEditor.getModel().uri.toString(),
          line: 2,
          character: 2,
          expression: "item"
        }]
      };
      
      return await window.rubbitLSPManager.client.sendRequest("workspace/executeCommand", params);
    });

    console.log("Loop Test Result:", result);
    // 期待値: "\" ruby \"", "\" web-assembly \"", "\" rubbit \""
    expect(result).toContain('" ruby "');
    expect(result).toContain('" web-assembly "');
    expect(result).toContain('" rubbit "');
    // カンマ区切りで3つあること
    expect(result.split(',').length).toBe(3);
  });
});
