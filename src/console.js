/**
 * コンソール・実行制御
 * console/index.js
 */
export class ConsoleComponent {
  /**
   * @param {HTMLElement} outputElement - 出力表示エリア
   * @param {HTMLElement} runButton - 実行ボタン
   * @param {HTMLElement} clearButton - クリアボタン
   * @param {RubyVM} rubyVM - RubyVM インスタンス
   * @param {EditorComponent} editor - エディタコンポーネント (コード取得用)
   */
  constructor(outputElement, runButton, clearButton, rubyVM, editor) {
    this.outputElement = outputElement
    this.runButton = runButton
    this.clearButton = clearButton
    this.rubyVM = rubyVM
    this.editor = editor

    // イベントの紐付け
    if (this.runButton) {
      this.runButton.addEventListener("click", () => this.run())
    }
    if (this.clearButton) {
      this.clearButton.addEventListener("click", () => this.clear())
    }

    // RubyVMの出力を購読
    // Note: RubyVMは単一の onOutput しか持っていないため、既存のものをラップするかイベントを使用する。
    // ここでは main.js で全て生成しているため、シンプルに onOutput を利用する。
    
    const originalOnOutput = this.rubyVM.onOutput
    this.rubyVM.onOutput = (text) => {
      if (originalOnOutput) originalOnOutput(text)
      this.appendOutput(text)
    }

    const originalOnReady = this.rubyVM.onReady
    this.rubyVM.onReady = (version) => {
      if (originalOnReady) originalOnReady(version)
      this.appendOutput(`// Ruby WASM ready! (Version: ${version})`)
    }
  }

  run() {
    if (!this.rubyVM) {
      this.appendOutput("// エラー: Ruby VM が初期化されていません。")
      return
    }

    if (!this.editor) {
      this.appendOutput("// エラー: エディタが準備できていません。")
      return
    }

    try {
      const code = this.editor.getValue()
      this.rubyVM.run(code)
    } catch (e) {
      this.appendOutput(`// エラー: ${e.message}`)
    }
  }

  clear() {
    if (this.outputElement) {
      this.outputElement.innerHTML = ""
    }
  }

  appendOutput(text) {
    if (!this.outputElement || !text) return

    // 初期化中メッセージが出ている場合は上書きする
    const lastLine = this.outputElement.lastElementChild
    if (lastLine && 
        lastLine.textContent.includes("// Ruby WASM initializing...") && 
        text.includes("// Ruby WASM ready!")) {
      lastLine.innerHTML = this.escapeHtml(text)
      return
    }

    this.outputElement.innerHTML += text.split("\n").map(line => 
      `<div>${this.escapeHtml(line)}</div>`
    ).join("")
    
    this.outputElement.lastElementChild?.scrollIntoView({ behavior: "smooth" })
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
