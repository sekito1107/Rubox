import { test, expect } from '@playwright/test';


test.describe('Ghost Text Verification', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    await page.goto('/');
    // 解析終了を待つ
    await page.waitForSelector('.monaco-editor');
    // カスタムイベントを待機して準備完了を確認
    await page.evaluate(async () => {
      for (let i = 0; i < 120; i++) { // 60秒
        if (window.rubbitLSPReady) return true;
        if (i % 20 === 0) console.log(`Waiting for rubbitLSPReady... i=${i}`);
        await new Promise(r => setTimeout(r, 500));
      }
      const debug = {
        lspReady: window.rubbitLSPReady,
        monaco: !!window.monaco,
        editor: !!window.monacoEditor,
        initializing: window.__rubyVMInitializing,
        ready: window.__rubyVMReady
      };
      throw new Error(`LSP initialization HANG detected. State: ${JSON.stringify(debug)}`);
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

  test('メソッド定義行でパラーメタを確認した際、未来の呼び出し時の値が表示されないこと', async ({ page }) => {
    const code = [
      'class DataProcessor',
      '  def self.format(text)',
      '    text.strip.capitalize',
      '  end',
      'end',
      '',
      'DataProcessor.format("ruby")'
    ].join('\n');

    await page.evaluate((c) => {
      window.monacoEditor.setValue(c);
      window.rubbitLSPManager.flushDocumentSync();
    }, code);

    // 解析を待つ
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      if (!window.rubbitLSPManager) return "ERROR: rubbitLSPManager is not defined";
      
      const model = window.monacoEditor.getModel();
      const pos = { lineNumber: 2, column: 19 };
      const wordInfo = model.getWordAtPosition(pos);
      // ブラウザのコンソールに出力（playwrightが取得して表示する）
      console.log(`[Test Debug] Word at pos ${JSON.stringify(pos)} = ${wordInfo ? wordInfo.word : "NONE"}`);

      const params = {
        command: "typeprof.measureValue",
        arguments: [{
          uri: model.uri.toString(),
          line: 1, // 0-based
          character: 18, 
          expression: wordInfo ? wordInfo.word : "text"
        }]
      };
      
      const res = await window.rubbitLSPManager.client.sendRequest("workspace/executeCommand", params);
      console.log(`[Test Debug] measureValue result = "${res}"`);
      return res;
    });

    // 未来の値 "ruby" が含まれていないことを確認
    expect(result).not.toContain('"ruby"');
    // 定義段階のエラーが含まれていることを確認
    expect(result.toString()).toMatch(/NameError|undefined local variable/i);
  });
});
