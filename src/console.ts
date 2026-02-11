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

    // イベントの紐付け
    if (this.runButton) {
      this.runButton.addEventListener("click", () => this.run());
    }
    if (this.clearButton) {
      this.clearButton.addEventListener("click", () => this.clear());
    }

    // RubyVMの出力を購読
    // Note: RubyVMは単一の onOutput しか持っていないため、既存のものをラップするかイベントを使用する。
    // ここでは main.js で全て生成しているため、シンプルに onOutput を利用する。
    
    const originalOnOutput = this.rubyVM.onOutput;
    this.rubyVM.onOutput = (text: string) => {
      if (originalOnOutput) originalOnOutput(text);
      this.appendOutput(text);
    };

    const originalOnReady = this.rubyVM.onReady;
    this.rubyVM.onReady = (version: string) => {
      if (originalOnReady) originalOnReady(version);
      this.appendOutput(`// Ruby WASM ready! (Version: ${version})`);
    };
  }

  public run(): void {
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

    // 初期化中メッセージが出ている場合は上書きする
    const lastLine = this.outputElement.lastElementChild;
    if (lastLine && 
        lastLine.textContent?.includes("// Ruby WASM initializing...") && 
        text.includes("// Ruby WASM ready!")) {
      lastLine.innerHTML = this.escapeHtml(text);
      return;
    }

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
