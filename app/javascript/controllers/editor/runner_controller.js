import { Controller } from "@hotwired/stimulus"

const WASM_API_URL = "https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm"
const RUBY_WASM_URL = "https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi/dist/ruby+stdlib.wasm"

export default class extends Controller {
  static targets = ["output"]
  
  async connect() {
    this.editor = null
    this.vm = null
    
    // エディタの初期化を監視 (bindして保持することでdisconnect時に解除可能にする)
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
    
    // バックグラウンドで Ruby VM を初期化
    this.initializeVM()
  }

  disconnect() {
    // イベントリスナーを解除してメモリリークを防ぐ
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  handleEditorInit(event) {
    this.editor = event.detail.editor
  }

  async initializeVM() {
    try {
      // 既にグローバルにVMがキャッシュされていれば再利用
      if (window.__rubyVM) {
        this.vm = window.__rubyVM
        this.updateOutput("// Ruby WASM ready! Click Run to execute code.")
        this.broadcastVersion()
        return
      }

      this.updateOutput("// Ruby WASM initializing...")
      
      // Ruby WASM API を動的インポート (ESM版)
      const { DefaultRubyVM } = await import(WASM_API_URL)
      
      // WASM モジュールの取得とコンパイル
      const response = await fetch(RUBY_WASM_URL)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText} (${RUBY_WASM_URL})`)
      }

      const module = await WebAssembly.compileStreaming(response)
      
      // VM の初期化
      const { vm } = await DefaultRubyVM(module)
      this.vm = vm
      
      // グローバルにキャッシュ (同一セッション内での再利用のため)
      window.__rubyVM = vm
      
      this.updateOutput("// Ruby WASM ready! Click Run to execute code.")
      this.broadcastVersion()
    } catch (error) {
      console.error("Ruby VM の初期化に失敗しました:", error)
      this.updateOutput(`// Error: Failed to initialize Ruby VM: ${error.message}`)
    }
  }

  broadcastVersion() {
    if (!this.vm) return
    try {
      const version = this.vm.eval("RUBY_VERSION").toString()
      const event = new CustomEvent("editor--runner:version-loaded", {
        detail: { version: `Ruby ${version}` }
      })
      window.dispatchEvent(event)
    } catch (e) {
      console.error("Ruby バージョンの取得に失敗:", e)
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
      this.updateOutput("// Ruby VM is not ready yet. Please wait...")
      return
    }

    if (!this.editor) {
      this.updateOutput("// Editor not available.")
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
        this.updateOutput("// (no output)")
      }
    } catch (error) {
      this.updateOutput(`Error: ${error.message}`)
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
