import { Controller } from "@hotwired/stimulus"

const WASM_API_URL = "https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm"
const RUBY_WASM_URL = "https://cdn.jsdelivr.net/npm/@ruby/3.3-wasm-wasi@2.8.1/dist/ruby+stdlib.wasm"

export default class extends Controller {
  static targets = ["output"]
  
  async connect() {
    this.editor = null
    this.vm = null
    
    // エディタの初期化を監視
    document.addEventListener("editor--main:initialized", (e) => {
      this.editor = e.detail.editor
    })
    
    // バックグラウンドで Ruby VM を初期化
    this.initializeVM()
  }

  async initializeVM() {
    try {
      this.updateOutput("// Ruby WASM を初期化中...")
      
      // Ruby WASM API を動的インポート (ESM版)
      const { DefaultRubyVM } = await import(WASM_API_URL)
      
      // WASM モジュールの取得とコンパイル
      const response = await fetch(RUBY_WASM_URL)
      const module = await WebAssembly.compileStreaming(response)
      
      // VM の初期化
      const { vm } = await DefaultRubyVM(module)
      this.vm = vm
      
      this.updateOutput("// Ruby WASM 準備完了！ Run ボタンで実行できます。")
    } catch (error) {
      console.error("Ruby VM の初期化に失敗しました:", error)
      this.updateOutput(`// エラー: Ruby VM の初期化に失敗しました: ${error.message}`)
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      const script = document.createElement("script")
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  async run() {
    if (!this.vm) {
      this.updateOutput("// Ruby VM の準備がまだできていません。少々お待ちください...")
      return
    }

    if (!this.editor) {
      this.updateOutput("// エディタが見つかりません。")
      return
    }

    const code = this.editor.getValue()
    
    try {
      // StringIO を使って標準出力をキャプチャする
      const wrappedCode = [
        "require 'stringio'",
        "$stdout = StringIO.new",
        "begin",
        code,
        "rescue => e",
        '  puts "Error: #{e.class}: #{e.message}"',
        "end",
        "$stdout.string"
      ].join("\n")
      
      const result = this.vm.eval(wrappedCode)
      const output = result.toString()
      
      if (output.trim()) {
        this.updateOutput(output)
      } else {
        this.updateOutput("// (出力なし)")
      }
    } catch (error) {
      this.updateOutput(`実行エラー: ${error.message}`)
    }
  }

  clear() {
    if (this.hasOutputTarget) {
      this.outputTarget.innerHTML = ""
    }
  }

  updateOutput(text) {
    if (this.hasOutputTarget) {
      this.outputTarget.innerHTML = text.split("\n").map(line => 
        `<div>${this.escapeHtml(line)}</div>`
      ).join("")
    }
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
