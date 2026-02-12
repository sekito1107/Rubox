/**
 * コンソール・実行制御
 * console/index.ts
 */
import { RubyVM } from "./ruby-vm";
import { EditorComponent } from "./editor";

export class ConsoleComponent {
  private outputElement: HTMLElement | null;
  private runButton: HTMLElement | null;
  private clearButton: HTMLElement | null;
  private rubyVM: RubyVM;
  private editor: EditorComponent;
  private loadingAnimationId: number | null = null;

  /**
   * @param outputElement - 出力表示エリア
   * @param runButton - 実行ボタン
   * @param clearButton - クリアボタン
   * @param rubyVM - RubyVM インスタンス
   * @param editor - エディタコンポーネント (コード取得用)
   */
  constructor(
    outputElement: HTMLElement | null,
    runButton: HTMLElement | null,
    clearButton: HTMLElement | null,
    rubyVM: RubyVM,
    editor: EditorComponent
  ) {
    this.outputElement = outputElement;
    this.runButton = runButton;
    this.clearButton = clearButton;
    this.rubyVM = rubyVM;
    this.editor = editor;

    // Runボタンを初期状態で無効化
    if (this.runButton) {
      this.runButton.setAttribute("disabled", "true");
      this.runButton.classList.add("opacity-50", "cursor-not-allowed");
    }

    // ローディングUIの初期表示
    this.showLoadingUI(0, "Preparing...");
    this.startRabbitAnimation();

    // イベントの紐付け
    if (this.runButton) {
      this.runButton.addEventListener("click", () => this.run());
    }
    if (this.clearButton) {
      this.clearButton.addEventListener("click", () => this.clear());
    }

    // RubyVMの出力を購読
    const originalOnOutput = this.rubyVM.onOutput;
    this.rubyVM.onOutput = (text: string) => {
      if (originalOnOutput) originalOnOutput(text);
      this.appendOutput(text);
    };

    // 進捗イベントを購読
    window.addEventListener("rubpad:loading-progress", (event: Event) => {
      const { percent, message } = (event as CustomEvent).detail;
      this.updateLoadingProgress(percent, message);
    }); 

    // ショートカット実行イベント (Editorから発火)
    window.addEventListener("rubpad:run-trigger", () => {
      this.run()
    })

    // 全初期化完了イベントを購読
    window.addEventListener("rubpad:lsp-ready", (event: Event) => {
      const detail = (event as CustomEvent).detail;
      this.onFullyReady(detail?.version || "");
    });
  }

  /**
   * ローディングUIを表示する
   */
  private showLoadingUI(percent: number, message: string): void {
    if (!this.outputElement) return;

    const barWidth = 30;
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);

    this.outputElement.innerHTML = `
      <div id="loading-container" class="flex flex-col items-center justify-center h-full select-none" style="min-height: 100px;">
        <div id="rabbit-track" class="text-2xl mb-3 w-full overflow-hidden relative" style="height: 42px;">
          <span id="rabbit-emoji" class="absolute transition-all duration-1000 ease-in-out" style="left: ${percent}%; transform: scaleX(-1); line-height: 1;">🐇</span>
        </div>
        <div class="font-mono text-sm text-slate-500 dark:text-slate-400 mb-1">
          <span class="text-slate-600 dark:text-slate-300">[${bar}]</span> <span id="loading-percent" class="font-bold">${percent}%</span>
        </div>
        <div id="loading-message" class="text-xs text-slate-400 dark:text-slate-500 mt-1 animate-pulse">${message}</div>
      </div>
    `;
  }

  /**
   * うさぎアニメーションを開始する
   */
  private startRabbitAnimation(): void {
    // うさぎの微小な跳ね返りアニメーション
    let step = 0;
    this.loadingAnimationId = window.setInterval(() => {
      const rabbit = document.getElementById("rabbit-emoji");
      if (rabbit) {
        step = (step + 1) % 10;
        // 走っている感を出すため、サイン波で上下運動を表現
        const yOffset = Math.sin(step * (Math.PI / 5)) * 6;
        // scaleX(-1) を維持しつつ上下移動
        rabbit.style.transform = `scaleX(-1) translateY(${yOffset}px)`;
      }
    }, 100);
  }

  /**
   * 進捗を更新する
   */
  private updateLoadingProgress(percent: number, message: string): void {
    const percentEl = document.getElementById("loading-percent");
    const messageEl = document.getElementById("loading-message");
    const rabbit = document.getElementById("rabbit-emoji");

    if (percentEl && messageEl && rabbit) {
      // 既存のUI要素を更新
      percentEl.textContent = `${percent}%`;
      messageEl.textContent = message;
      rabbit.style.left = `calc(${Math.min(percent, 95)}% - 12px)`;

      // 進捗バーとバウンドアニメーションの同期を強める
      // (CSS transition が 1s なので、それに合わせて left が動く)
      const barWidth = 30;
      const filled = Math.round((percent / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      const barEl = rabbit.closest("#loading-container")?.querySelector(".text-slate-600, .dark\\:text-slate-300");
      if (barEl) {
        barEl.textContent = `[${bar}]`;
      }
    } else {
      // UI未生成の場合は再描画
      this.showLoadingUI(percent, message);
    }
  }

  /**
   * 全初期化完了時の処理
   */
  private onFullyReady(version: string): void {
    // アニメーション停止
    if (this.loadingAnimationId) {
      clearInterval(this.loadingAnimationId);
      this.loadingAnimationId = null;
    }

    // フェードアウト
    const container = document.getElementById("loading-container");
    if (container) {
      container.style.transition = "opacity 0.5s ease-out";
      container.style.opacity = "0";

      setTimeout(() => {
        // ターミナルクリア & Readyメッセージ表示
        if (this.outputElement) {
          this.outputElement.innerHTML = "";
          this.appendOutput(`// Ruby WASM ready! (Version: ${version})`);
        }

        // Runボタンを有効化
        if (this.runButton) {
          this.runButton.removeAttribute("disabled");
          this.runButton.classList.remove("opacity-50", "cursor-not-allowed");
        }

        // 右パネルを表示
        const sidebar = document.querySelector("aside.w-80");
        if (sidebar) {
          sidebar.classList.remove("hidden");
          sidebar.classList.add("animate-fade-in");
        }
      }, 500);
    } else {
      // フォールバック: container がない場合
      if (this.outputElement) {
        this.outputElement.innerHTML = "";
        this.appendOutput(`// Ruby WASM ready! (Version: ${version})`);
      }
      if (this.runButton) {
        this.runButton.removeAttribute("disabled");
        this.runButton.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
  }

  public run(): void {
    // 無効化中はスキップ
    if (this.runButton?.hasAttribute("disabled")) return;

    if (!this.rubyVM) {
      this.appendOutput("// エラー: Ruby VM が初期化されていません。");
      return;
    }

    if (!this.editor) {
      this.appendOutput("// エラー: エディタが準備できていません。");
      return;
    }

    try {
      const code = this.editor.getValue();
      this.rubyVM.run(code);
    } catch (e: any) {
      this.appendOutput(`// エラー: ${e.message}`);
    }
  }

  public clear(): void {
    if (this.outputElement) {
      this.outputElement.innerHTML = "";
    }
  }

  private appendOutput(text: string): void {
    if (!this.outputElement || !text) return;

    this.outputElement.innerHTML += text.split("\n").map(line => 
      `<div>${this.escapeHtml(line)}</div>`
    ).join("");
    
    this.outputElement.lastElementChild?.scrollIntoView({ behavior: "smooth" });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
