import { Controller } from "@hotwired/stimulus"
import { Runtime } from "../../runtime"

export default class extends Controller {
  static targets = ["output"]
  
  connect() {
    this.editor = null
    this.runner = null
    
    // エディタの初期化を監視する
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor:initialized", this.boundHandleEditorInit)
    
    // Ruby VMイベントを監視する
    this.element.addEventListener("ruby-vm:output", this.handleRubyOutput.bind(this))
    this.element.addEventListener("ruby-vm:ready", this.handleRubyReady.bind(this))
  }

  disconnect() {
    document.removeEventListener("editor:initialized", this.boundHandleEditorInit)
  }

  handleEditorInit(event) {
    this.editor = event.detail.editor
  }

  handleRubyOutput(event) {
    this.appendOutput(event.detail.text)
  }

  handleRubyReady(event) {
    this.appendOutput(`// Ruby WASM ready! (Version: ${event.detail.version})`)
  }

  run() {
    if (!this.runner) {
      const vmController = this.application.getControllerForElementAndIdentifier(this.element, "ruby-vm")
      if (vmController) {
        this.runtime = new Runtime(vmController)
        this.runner = this.runtime // executor の実体
      }
    }

    if (!this.runner) {
      this.appendOutput("// Error: Ruby VM Controller not found.")
      return
    }

    if (!this.editor) {
      this.appendOutput("// Error: Editor not ready.")
      return
    }

    try {
      this.runner.execute(this.editor.getValue())
    } catch (e) {
      this.appendOutput(`// Error: ${e.message}`)
    }
  }

  clear() {
    if (this.hasOutputTarget) {
      this.outputTarget.innerHTML = ""
    }
  }

  appendOutput(text) {
    if (!this.hasOutputTarget || !text) return

    // 初期化中メッセージが出ている場合は上書きする
    const lastLine = this.outputTarget.lastElementChild
    if (lastLine && 
        lastLine.textContent.includes("// Ruby WASM initializing...") && 
        text.includes("// Ruby WASM ready!")) {
      lastLine.innerHTML = this.escapeHtml(text)
      return
    }

    this.outputTarget.innerHTML += text.split("\n").map(line => 
      `<div>${this.escapeHtml(line)}</div>`
    ).join("")
    
    this.outputTarget.lastElementChild?.scrollIntoView({ behavior: "smooth" })
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
