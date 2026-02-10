import * as monaco from 'monaco-editor';
import type { LSPClient } from './client';
import type { ProvideInlayHints } from './inlay_hints';

/**
 * LSP 固有のコマンド (measureValue 等) をエディタ上で実行する
 */
export class ExecuteCommand {
  private client: LSPClient;
  private inlayHints: ProvideInlayHints;

  constructor(client: LSPClient, inlayHints: ProvideInlayHints) {
    this.client = client;
    this.inlayHints = inlayHints; // ProvideInlayHints インスタンス
  }

  /**
   * コマンドの登録を開始する
   */
  start(): void {
    monaco.editor.registerCommand("typeprof.measureValue", async (_accessor, ...args) => {
      try {
        const params = args[0] as { line: number; expression: string; character: number } | undefined;
        if (!params) return;

        const result = await this.client.sendRequest("workspace/executeCommand", { 
          command: "typeprof.measureValue", 
          arguments: [params] 
        });

        if (result !== undefined) {
          const line = params.line;
          if (line && this.inlayHints) {
            // インレイヒントを更新して表示
            this.inlayHints.update(line, result as string);
          } else {
            console.log(`Measured Value: ${result}`);
          }
        }
      } catch (e) {
        console.error("[ExecuteCommand] Command 'typeprof.measureValue' failed:", e);
      }
    });
  }
}
