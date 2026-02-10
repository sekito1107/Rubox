import { Controller } from "@hotwired/stimulus"
import * as monaco from 'monaco-editor'
import { Settings, CodePersistence } from "../persistence"

// Import Monaco workers directly for Vite
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

window.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

export default class extends Controller {
  static targets = ["container"]

  async connect() {
    this.persistence = new Persistence()
    this.settings = this.persistence.settings
    this.codePersistence = this.persistence.code
    this.boundHandleSettingsUpdate = this.handleSettingsUpdate.bind(this)
    window.addEventListener("settings:updated", this.boundHandleSettingsUpdate)

    try {
      this.initEditor()
    } catch (error) {
      if (this.hasContainerTarget) {
        this.containerTarget.innerText = "Failed to load editor."
      }
      console.error(error)
    }
  }

  disconnect() {
    window.removeEventListener("settings:updated", this.boundHandleSettingsUpdate)
    if (this.editor) this.editor.dispose()
    if (this.observer) this.observer.disconnect()
    if (this.saveTimer) clearTimeout(this.saveTimer)
  }

  initEditor() {
    const savedSettings = this.settings.getAll()
    const savedCode = this.codePersistence.load()

    this.editor = monaco.editor.create(this.containerTarget, {
      value: savedCode || [
        "# Welcome to RubPad!",
        "# Type code here and see Reference links appear on the right.",
        "",
        "names = ['Ruby', 'Python', 'JavaScript']",
        "",
        "names.select { |n| n.include?('u') }",
        "  .map(&:upcase)",
        "  .each do |n|",
        "    puts \"Hello, #{n}!\"",
        "  end",
        "",
        "# Try typing .split or .size below:",
        ""
      ].join("\n"),
      language: "ruby",
      theme: this.currentTheme,
      automaticLayout: true,
      minimap: savedSettings.minimap || { enabled: false },
      fontSize: parseInt(savedSettings.fontSize || 14),
      tabSize: parseInt(savedSettings.tabSize || 2),
      wordWrap: savedSettings.wordWrap || 'off',
      autoClosingBrackets: savedSettings.autoClosingBrackets || 'always',
      mouseWheelZoom: savedSettings.mouseWheelZoom || false,
      renderWhitespace: savedSettings.renderWhitespace || 'none',
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace"
    })

    window.monacoEditor = this.editor

    // コードの永続化
    this.editor.onDidChangeModelContent(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => {
        this.codePersistence.save(this.editor.getValue())
      }, 1000)
    })

    this.observer = new MutationObserver(() => this.updateTheme())
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    this.element.dispatchEvent(new CustomEvent("editor:initialized", {
      detail: { editor: this.editor },
      bubbles: true 
    }))
  }

  updateTheme() {
    if (this.editor) monaco.editor.setTheme(this.currentTheme)
  }

  get currentTheme() {
    return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs"
  }

  handleSettingsUpdate(event) {
    if (!this.editor) return
    const s = event.detail.settings
    
    this.editor.updateOptions({
      fontSize: parseInt(s.fontSize),
      tabSize: parseInt(s.tabSize),
      wordWrap: s.wordWrap,
      autoClosingBrackets: s.autoClosingBrackets,
      minimap: s.minimap,
      mouseWheelZoom: s.mouseWheelZoom,
      renderWhitespace: s.renderWhitespace
    })
  }

  /**
   * Alias for compatibility with console controller run action
   */
  run() {
    const consoleCtrl = this.application.getControllerForElementAndIdentifier(this.element, "editor--console")
    if (consoleCtrl) consoleCtrl.run()
  }
}
