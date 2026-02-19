import type { LSPClient } from './client';

declare global {
  interface Window {
    __rubyLSPInitialAnalysisFinished: boolean;
  }
}

// LSP サーバの起動と初期化シーケンス（Handshake）を管理する
export class BootLSP {
  private client: LSPClient;

  constructor(client: LSPClient) {
    this.client = client;
  }

  // LSP サーバの初期化プロセスを実行する
  async execute(): Promise<any> {
    // 1. Diagnostics 通知の初回受信を監視して「解析完了」を検知する準備
    this.setupInitialAnalysisListener();

    // 2. 'initialize' リクエストの送信 (TypeProf 向け)
    const result = await this.client.sendRequest("initialize", {
      processId: null,
      rootUri: "inmemory:///workspace/",
      capabilities: {
        textDocument: {
          publishDiagnostics: {}
        }
      },
      workspaceFolders: [{ uri: "inmemory:///workspace/", name: "workspace" }]
    });

    return result;
  }

  private setupInitialAnalysisListener(): void {
    window.__rubyLSPInitialAnalysisFinished = false;

    const handler = (): void => {
      if (!window.__rubyLSPInitialAnalysisFinished) {
        window.__rubyLSPInitialAnalysisFinished = true;
        // システム全体に初回の解析完了を通知
        window.dispatchEvent(new CustomEvent("rubox:lsp-analysis-finished"));
      }
    };

    this.client.onNotification("textDocument/publishDiagnostics", handler);
  }
}
