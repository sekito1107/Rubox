import { RubyVM } from "./ruby-vm";
import { LSP } from "./lsp";
import { Reference } from "./reference";
import { AnalysisCoordinator } from "./analysis";

/**
 * アプリケーションの初期化シーケンス（ブートローダー）
 * 依存関係の解決と起動順序の制御を行う
 */
export class BootLoader {
  private rubyVM: RubyVM;
  private editor: any;
  private lspManager: LSP | null = null;
  private reference: Reference | null = null;
  private analysis: AnalysisCoordinator | null = null;

  constructor(rubyVM: RubyVM, editor: any) {
    this.rubyVM = rubyVM;
    this.editor = editor;
  }

  /**
   * システム初期化を開始
   */
  public async boot(): Promise<void> {
    // 0. 依存関係の準備待ち
    // RubyVM (WASM) の初期化完了を待つ
    await this.rubyVM.readyPromise;

    if (!this.rubyVM.lspClient) {
      console.error("LSP Client is not ready in RubyVM");
      return;
    }

    // 1. LSPの初期化
    this.dispatchProgress(90, "LSP: サーバーを起動中...");
    this.lspManager = new LSP(this.rubyVM.lspClient, this.editor);
    
    this.dispatchProgress(92, "LSP: 初期化リクエスト送信...");
    await this.lspManager.initialize();
    
    this.dispatchProgress(94, "LSP: 機能を有効化中...");
    this.lspManager.activate();
    
    // 互換性のためのグローバル公開
    window.rubbitLSPManager = this.lspManager;
    window.rubbitLSPReady = true;
    window.dispatchEvent(new CustomEvent("rubbit:lsp-analysis-finished"));

    // 2. リファレンスの読み込み
    this.dispatchProgress(95, "リファレンス索引をロード中...");
    this.reference = new Reference(this.rubyVM.lspClient);
    
    this.dispatchProgress(96, "リファレンス: 索引構築...");
    await this.reference.loadIndex();

    // 3. 解析機能の起動
    this.dispatchProgress(98, "解析エンジンを起動中...");
    this.analysis = new AnalysisCoordinator(this.editor, this.lspManager, this.reference);
    window.rubbitAnalysisCoordinator = this.analysis;
    this.analysis.start();

    this.dispatchProgress(100, "準備完了！");

    window.dispatchEvent(new CustomEvent("rubbit:lsp-ready", {
        detail: { version: (this.rubyVM as any).rubyVersion }
    }));
  }

  private dispatchProgress(percent: number, message: string): void {
    window.dispatchEvent(new CustomEvent("rubbit:loading-progress", {
      detail: { percent, message }
    }));
  }

  /**
   * リソースの破棄とグローバル汚染のクリーンアップ
   */
  public destroy(): void {
    if (window.rubbitLSPManager === this.lspManager) delete window.rubbitLSPManager;
    if (window.rubbitAnalysisCoordinator === this.analysis) delete window.rubbitAnalysisCoordinator;
    delete window.rubbitLSPReady;
    
    this.lspManager = null;
    this.reference = null;
    this.analysis = null;
  }
}
