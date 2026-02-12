import { test, expect } from '@playwright/test';


test.describe('Ghost Text Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 解析終了を待つ
    await page.waitForSelector('.monaco-editor');
    // カスタムイベントを待機して準備完了を確認
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.rubpadLSPReady) resolve(true);
        window.addEventListener('rubpad:lsp-analysis-finished', () => resolve(true), { once: true });
      });
    });
  });

  test('長い配列の結果が切り詰められずに表示されること', async ({ page }) => {
    // 1..20 の配列は inspect すると約 60-70 文字になるはず。
    const code = 'x = (1..20).to_a';
    await page.evaluate((c) => {
      window.monacoEditor.setValue(c);
      window.rubpadLSPManager.flushDocumentSync();
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
        
        // すべてのエディタコマンドを取得するには、静的な monaco.editor.getCommands ではなく、
        // 内部APIにアクセスするか、あるいは特定のアクションIDを直接実行する必要があるかもしれない。
        // ただし、以前のコードでは window.monaco.editor.getCommands() を呼んでいたが、これは存在しない関数かもしれない。
        // 正しくは editor インスタンスから getAction を使うか、あるいは trigger を使う。
        
        // しかし、TypeProf の measureValue はカスタムコマンドとして登録されているはず。
        // editor.addCommand で登録されたものは、単純に trigger で呼べるか？
        // いいえ、addCommand の戻り値は Disposable です。
        
        // 登録されたコマンドを探す
        // Monaco の内部構造（StandaloneCodeEditor）には _commandService があるが、アクセスは難しい。
        
        // 実は getCommands は存在しない。
        // エディタインスタンス経由でアクションを実行する方が確実だが、
        // typeprof.measureValue は addCommand で登録されているため、Action ではない。
        
        // そこで、Action としてではなく、Keybinding 経由か、あるいは
        // コマンドサービスから直接実行する必要がある。
        
        // 回避策: executeCommand を使う
        // しかし monaco.editor に executeCommand はない。
        
        // 調査: src/lsp/execute_command.ts を見ると、LSPの executeCommand リクエストを送っているだけ。
        // つまり、フロントエンドのコマンドを実行しているわけではない。
        // いや、inlayHints.ts や hover.ts から呼ばれる。
        
        // hover.ts では:
        // window.rubpadLSPManager.client.sendRequest("workspace/executeCommand", ...)
        // としている。
        
        // なので、テストでも直接 LSP クライアントを呼ぶのが一番早いし確実。
        
        if (!window.rubpadLSPManager) {
            return "ERROR: rubpadLSPManager is not defined";
        }
        
        const params = {
            command: "typeprof.measureValue",
            arguments: [{
                uri: window.monacoEditor.getModel().uri.toString(),
                line: 0, // 0-based index (user input line 1 is index 0)
                character: 0,
                expression: "x"
            }]
        };
        
        // LSPクライアントのメソッドを直接呼ぶ
        const result = await window.rubpadLSPManager.client.sendRequest("workspace/executeCommand", params);
        console.log("DEBUG: measureValue result =", result);
        return result;

      } catch (e) {
        console.log("ERROR: measureValue threw:", e.toString());
        return "ERROR: " + e.toString();
      }
    });




    // 以前の 30-40 文字制限なら途中で ... になるはずだが、今は 150 文字まで許容される

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
      window.rubpadLSPManager.flushDocumentSync();
    }, code);

    // 解析を待つ
    await page.waitForTimeout(1000);

    const result = await page.evaluate(async () => {
      if (!window.rubpadLSPManager) return "ERROR: rulesLSPManager is not defined";
      
      const params = {
        command: "typeprof.measureValue",
        arguments: [{
          uri: window.monacoEditor.getModel().uri.toString(),
          line: 2, // 0-based index. Line 3 is index 2.
          character: 2,
          expression: "item"
        }]
      };
      
      return await window.rubpadLSPManager.client.sendRequest("workspace/executeCommand", params);
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
