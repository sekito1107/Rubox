import { Controller } from "@hotwired/stimulus"
import { LSPClient } from "../lsp/client"
import { LSP } from "../lsp"
import { Reference } from "../reference"
import { AnalysisCoordinator } from "../analysis"

const RUBY_WASM_URL = "/js/rubpad.wasm"
const WORKER_URL = "/js/ruby_worker.js" 

// Ruby VMのライフサイクルと実行を管理する (Worker版)
export default class extends Controller {
  async connect() {
    this.worker = null
    this.lspClient = null
    this.editor = null
    this.lspManager = null
    this.rurima = null
    this.analysis = null

    // エディタの初期化イベントを監視
    this.boundHandleEditorInitialized = this.handleEditorInitialized.bind(this)
    window.addEventListener("editor--main:initialized", this.boundHandleEditorInitialized)
    
    if (window.monacoEditor) {
      this.handleEditorInitialized({ detail: { editor: window.monacoEditor } })
    }

    if (!window.__rubyVMInitializing && !window.__rubyVMReady) {
      window.__rubyVMInitializing = true
      this.initializeWorker()
    }
  }

  initializeWorker() {
    try {
      this.worker = new Worker(WORKER_URL, { type: "module" })
      this.lspClient = new LSPClient(this.worker)
      window.rubyLSP = this.lspClient 
      
      this.worker.addEventListener("message", (event) => {
        const { type, payload } = event.data
        this.handleWorkerMessage(type, payload)
      })

      this.worker.postMessage({ 
        type: "initialize", 
        payload: { wasmUrl: RUBY_WASM_URL } 
      })
    } catch (error) {
      this.dispatchOutput(`// Error starting worker: ${error.message}`)
    }
  }

  handleWorkerMessage(type, payload) {
    switch (type) {
        case "output":
            this.dispatchOutput(payload.text)
            break
        case "ready":
            window.__rubyVMReady = true
            delete window.__rubyVMInitializing
            this.dispatch("version-loaded", { detail: { version: payload.version } })
            this.verifyLSP()
            break
        case "error":
            this.dispatchOutput(`// VM Error: ${payload.message}`)
            break
    }
  }

  run(code) {
    if (!this.worker) {
      this.dispatchOutput("// Ruby VM Worker is not initialized.")
      return
    }
    this.worker.postMessage({ type: "run", payload: { code } })
  }

  dispatchOutput(text) {
    this.dispatch("output", { detail: { text } })
  }
  
  disconnect() {
    window.removeEventListener("editor--main:initialized", this.boundHandleEditorInitialized)
    if (this.worker) this.worker.terminate()
    if (window.rubyLSP === this.lspClient) delete window.rubyLSP
    if (window.rubpadLSPManager === this.lspManager) delete window.rubpadLSPManager
  }

  handleEditorInitialized(event) {
    this.editor = event.detail.editor
    this.tryActivateDomains()
  }

  async tryActivateDomains() {
    if (this.lspClient && this.editor && !this.lspManager && window.__rubyVMReady) {
      this.lspManager = new LSP(this.lspClient, this.editor)
      
      try {
        await this.lspManager.initialize()
        this.lspManager.activate()
        window.rubpadLSPManager = this.lspManager

        // Reference ドメインの初期化
        this.reference = new Reference()
        await this.reference.loadIndex()
        
        // 解析コーディネーターの初期化
        this.analysis = new AnalysisCoordinator(this.editor, this.lspManager, this.reference)
        window.rubpadAnalysisCoordinator = this.analysis
        this.analysis.start()
        
        window.dispatchEvent(new CustomEvent("rubpad:lsp-ready"))
      } catch (e) {
        console.error("[RubyVMController] Failed to initialize domains:", e)
      }
    }
  }

  async verifyLSP() {
    this.tryActivateDomains()
  }
}
