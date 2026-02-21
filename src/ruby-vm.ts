import { LSPClient } from "./lsp/client";
import RubyWorker from "./ruby-worker?worker";

// グローバル定義は src/types.d.ts に移動

const RUBY_WASM_URL = "/ruby/rubox.wasm";

// Ruby VM & 実行時マネージャ
export class RubyVM {
  private static isInitializing = false;
  private static isReady = false;

  private worker: Worker | null = null;
  public lspClient: LSPClient | null = null;
  public rubyVersion: string = "";

  // 出力用イベントリスナー
  public onOutput: ((text: string) => void) | null = null;
  public readyPromise: Promise<void>;
  private resolveReady: (() => void) | null = null;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    if (!RubyVM.isInitializing && !RubyVM.isReady) {
      RubyVM.isInitializing = true;
      this.initializeWorker();
    }
  }

  // Workerを初期化し、LSPクライアントをセットアップする
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
        payload: { wasmUrl: RUBY_WASM_URL },
      });
    } catch (error: any) {
      this.dispatchOutput(`// Workerの起動に失敗しました: ${error.message}`);
    }
  }

  // Workerからのメッセージを処理する
  private handleWorkerMessage(type: string, payload: any): void {
    switch (type) {
      case "output":
        this.dispatchOutput(payload.text);
        break;
      case "progress":
        // Workerからの進捗イベントを中継
        window.dispatchEvent(
          new CustomEvent("rubox:loading-progress", {
            detail: { percent: payload.percent, message: payload.message },
          })
        );
        break;
      case "ready":
        RubyVM.isReady = true;
        RubyVM.isInitializing = false;
        // onReady はローディング統合のため版数を保存するのみ
        this.rubyVersion = payload.version;

        if (this.resolveReady) {
          this.resolveReady();
        }
        break;
      case "error":
        this.dispatchOutput(`// VM Error: ${payload.message}`);
        break;
    }
  }

  // コードを実行する
  public run(code: string, stdin?: string): void {
    if (!this.worker) {
      this.dispatchOutput("// Ruby VM Worker が初期化されていません。");
      return;
    }
    this.worker.postMessage({ type: "run", payload: { code, stdin } });
  }

  // 標準入力を更新する (LSPなどからの参照用)
  public updateStdin(stdin: string): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: "updateStdin", payload: { stdin } });
  }

  // 出力イベントを発火する
  private dispatchOutput(text: string): void {
    if (this.onOutput) this.onOutput(text);
  }

  public destroy(): void {
    if (this.worker) this.worker.terminate();
    if (window.rubyLSP === this.lspClient) delete window.rubyLSP;
  }
}
