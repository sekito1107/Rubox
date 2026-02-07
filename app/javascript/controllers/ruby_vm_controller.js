import { Controller } from "@hotwired/stimulus"
import { LSPClient } from "utils/lsp_client"
import { LSPInteractor } from "interactors/lsp_interactor"

const RUBY_WASM_URL = "/js/rubpad.wasm"
// Rails 8 / Importmap: Workerのパス解決が必要
// moduleタイプのWorkerがサポートされていると仮定し、必要に応じてclassicスクリプトとして読み込む
// ただ、Worker内でimportを使用しているため、type: "module" が必須
// Asset Pipelineの問題を回避するため、Workerファイル自体は public/js から読み込む
const WORKER_URL = "/js/ruby_worker.js" 

// Ruby VMのライフサイクルと実行を管理する (Worker版)
export default class extends Controller {
  async connect() {
    this.worker = null
    this.lspClient = null
    this.editor = null
    this.interactor = null

    // エディタの初期化イベントを監視
    this.boundHandleEditorInitialized = this.handleEditorInitialized.bind(this)
    window.addEventListener("editor--main:initialized", this.boundHandleEditorInitialized)
    
    // まだ準備ができていない場合、バックグラウンドでVMを初期化する
    if (!window.__rubyVMInitializing && !window.__rubyVMReady) {
      window.__rubyVMInitializing = true
      this.initializeWorker()
    } else {
        // 必要ならここで再接続機能を追加できる（Workerインスタンスをグローバルに保持する場合など）
        // 現状はシングルページ利用またはリロードを前提とする
    }
  }

  initializeWorker() {
    try {
      // type: "module" は、Worker内で 'import' を使用するために重要
      this.worker = new Worker(WORKER_URL, { type: "module" })
      
      // WorkerをラップしたLSPクライアントを初期化
      this.lspClient = new LSPClient(this.worker)
      
      // 他のコントローラー（エディタなど）からアクセスできるように公開する
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
      console.error("Worker Init Error:", error)
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
            this.dispatch("ready", { detail: { version: payload.version } })
            
            // LSPの自動検証を開始
            this.verifyLSP()
            break
        case "error":
            this.dispatchOutput(`// VM Error: ${payload.message}`)
            break
    }
  }

  // コードを実行するAPI
  run(code) {
    if (!this.worker) {
      this.dispatchOutput("// Ruby VM Worker is not initialized.")
      return
    }
    
    this.worker.postMessage({ type: "run", payload: { code } })
  }

  dispatchOutput(text) {
    // リスナー（ConsoleControllerなど）に通知する
    this.dispatch("output", { detail: { text } })
  }
  
  disconnect() {
    window.removeEventListener("editor--main:initialized", this.boundHandleEditorInitialized)
    if (this.worker) {
      this.worker.terminate()
    }
    if (window.rubyLSP === this.lspClient) {
      delete window.rubyLSP
    }
    if (window.rubpadLSPInteractor === this.interactor) {
      delete window.rubpadLSPInteractor
    }
  }

  handleEditorInitialized(event) {
    this.editor = event.detail.editor
    this.tryActivateInteractor()
  }

  tryActivateInteractor() {
    // VMが準備完了(ready)し、かつエディタも初期化されている場合のみアクティブ化する
    if (this.lspClient && this.editor && !this.interactor && window.__rubyVMReady) {
      this.interactor = new LSPInteractor(this.lspClient, this.editor)
      this.interactor.activate()
      window.rubpadLSPInteractor = this.interactor
      
      // Notify other controllers that LSP is ready
      window.dispatchEvent(new CustomEvent("rubpad:lsp-ready"))
    }
  }

  async verifyLSP() {
    try {
      // TypeProf に 'initialize' リクエストを送信
      const result = await this.lspClient.sendRequest("initialize", {
        processId: null,
        rootUri: "inmemory:///workspace/",
        capabilities: {},
        workspaceFolders: [{ uri: "inmemory:///workspace/", name: "workspace" }]
      })
      
      this.tryActivateInteractor()

      // 初回のドキュメント同期を行うために通知
      if (this.editor) {
        // ...必要であれば
      }
    } catch (e) {
      console.error("LSP Verification Failed:", e)
    }
  }
}
