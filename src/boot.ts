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
  private editor: any; // monaco.editor.IStandaloneCodeEditor
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
    if (!this.rubyVM.lspClient) {
      console.warn("LSP Client is not ready in RubyVM");
      return;
    }

    // 1. LSPの初期化
    this.dispatchProgress(70, "Starting Language Server...");
    this.lspManager = new LSP(this.rubyVM.lspClient, this.editor);
    await this.lspManager.initialize();
    this.lspManager.activate();
    
    // 互換性のためのグローバル公開
    window.rubbitLSPManager = this.lspManager;
    window.rubbitLSPReady = true;
    window.dispatchEvent(new CustomEvent("rubbit:lsp-analysis-finished"));

    // 2. リファレンスの読み込み
    this.dispatchProgress(85, "Loading Reference Index...");
    this.reference = new Reference();
    await this.reference.loadIndex();

    // 3. 解析機能の起動
    this.dispatchProgress(100, "Ready!");
    this.analysis = new AnalysisCoordinator(this.editor, this.lspManager, this.reference);
    window.rubbitAnalysisCoordinator = this.analysis;
    this.analysis.start();

    // 初期化完了 (バージョン情報はVM側から通知されるため、ここでは解析完了のみ)
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
