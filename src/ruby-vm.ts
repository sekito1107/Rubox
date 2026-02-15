import { LSPClient } from "./lsp/client";
import RubyWorker from "./ruby-worker?worker";

// グローバル定義は src/types.d.ts に移動

const RUBY_WASM_URL = "/ruby/rubbit.wasm";

/**
 * Ruby VM & 実行時マネージャ
 */
export class RubyVM {
  private worker: Worker | null = null;
  public lspClient: LSPClient | null = null;
  private editor: any = null;
  private bootLoader: any = null;
  private rubyVersion: string = "";

  // 出力用イベントリスナー
  public onOutput: ((text: string) => void) | null = null;
  public onReady: ((version: string) => void) | null = null;

  private boundHandleEditorInitialized: (event: Event) => void;

  constructor() {
    // エディタの初期化イベントを監視
    this.boundHandleEditorInitialized = this.handleEditorInitialized.bind(this) as EventListener;
    window.addEventListener("editor:initialized", this.boundHandleEditorInitialized);

    if (window.monacoEditor) {
      this.handleEditorInitialized({ detail: { editor: window.monacoEditor } } as any);
    }

    if (!window.__rubyVMInitializing && !window.__rubyVMReady) {
      window.__rubyVMInitializing = true;
      this.initializeWorker();
    }
  }

  /**
   * Workerを初期化し、LSPクライアントをセットアップする
   */
  private initializeWorker(): void {
    try {
      this.worker = new RubyWorker();
      this.lspClient = new LSPClient(this.worker);
      window.rubyLSP = this.lspClient;

      this.worker.addEventListener("message", (event) => {
        const { type, payload } = event.data;
        this.handleWorkerMessage(type, payload);
      });

      this.worker.postMessage({
        type: "initialize",
        payload: { wasmUrl: RUBY_WASM_URL }
      });
    } catch (error: any) {
      this.dispatchOutput(`// Workerの起動に失敗しました: ${error.message}`);
    }
  }

  /**
   * Workerからのメッセージを処理する
   */
  private handleWorkerMessage(type: string, payload: any): void {
    switch (type) {
      case "output":
        this.dispatchOutput(payload.text);
        break;
      case "progress":
        // Workerからの進捗イベントを中継
        window.dispatchEvent(new CustomEvent("rubbit:loading-progress", {
          detail: { percent: payload.percent, message: payload.message }
        }));
        break;
      case "ready":
        window.__rubyVMReady = true;
        delete window.__rubyVMInitializing;
        // onReady はローディング統合のため版数を保存するのみ
        this.rubyVersion = payload.version;

        // 下位互換性のためにイベントを発火
        window.dispatchEvent(new CustomEvent("ruby-vm:ready", { detail: { version: payload.version } }));

        this.verifyLSP();
        break;
      case "error":
        this.dispatchOutput(`// VM Error: ${payload.message}`);
        break;
    }
  }

  /**
   * コードを実行する
   */
  public run(code: string): void {
    if (!this.worker) {
      this.dispatchOutput("// Ruby VM Worker が初期化されていません。");
      return;
    }
    this.worker.postMessage({ type: "run", payload: { code } });
  }

  /**
   * 出力イベントを発火する
   */
  private dispatchOutput(text: string): void {
    if (this.onOutput) this.onOutput(text);

    // レガシーサポート
    window.dispatchEvent(new CustomEvent("ruby-vm:output", { detail: { text } }));
  }

  /**
   * エディタ初期化時のハンドラ
   */
  private handleEditorInitialized(event: any): void {
    this.editor = event.detail.editor;
    this.tryActivateDomains();
  }

  /**
   * 各ドメイン（LSP, Reference, Analysis）の有効化を試みる
   */
  private async tryActivateDomains(): Promise<void> {
    if (this.lspClient && this.editor && !this.bootLoader && window.__rubyVMReady) {
      // BootLoaderの遅延読み込みと初期化
      const { BootLoader } = await import("./boot");
      this.bootLoader = new BootLoader(this, this.editor);

      await this.bootLoader.boot();
      
      window.dispatchEvent(new CustomEvent("rubbit:lsp-ready", {
        detail: { version: this.rubyVersion }
      }));
    }
  }

  /**
   * LSPの検証と有効化を行う
   */
  private async verifyLSP(): Promise<void> {
    this.tryActivateDomains();
  }

  /**
   * リソースを破棄する
   */
  public destroy(): void {
    window.removeEventListener("editor:initialized", this.boundHandleEditorInitialized);
    if (this.worker) this.worker.terminate();
    if (window.rubyLSP === this.lspClient) delete window.rubyLSP;
    if (this.bootLoader) {
      this.bootLoader.destroy();
    }
  }
}
