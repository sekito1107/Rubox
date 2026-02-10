/**
 * エディタ機能 (Vanilla JS Component)
 * editor/index.js
 */
import * as monaco from 'monaco-editor'

// Vite用にMonaco workerを直接インポート
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

export class EditorComponent {
  /**
   * @param {HTMLElement} containerElement - エディタを表示するコンテナ
   * @param {Persistence} persistence - 永続化ドメイン
   */
  constructor(containerElement, persistence) {
    this.container = containerElement
    this.settings = persistence.settings
    this.codePersistence = persistence.code
    
    this.saveTimer = null

    this.initEditor()
    
    // 設定変更イベントの監視 (SettingsComponentからの通知)
    this.boundHandleSettingsUpdate = this.handleSettingsUpdate.bind(this)
    window.addEventListener("settings:updated", this.boundHandleSettingsUpdate)
    
    // テーマ監視
    this.observer = new MutationObserver(() => this.updateTheme())
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  }

  initEditor() {
    if (!this.container) return

    const savedSettings = this.settings.getAll()
    const savedCode = this.codePersistence.load()

    this.editor = monaco.editor.create(this.container, {
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

    // グローバルアクセス用 (テスト等で利用)
    window.monacoEditor = this.editor

    // コードの永続化
    this.editor.onDidChangeModelContent(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => {
        this.codePersistence.save(this.editor.getValue())
      }, 1000)
    })

    // 初期化完了イベント発火 (依存コンポーネント用)
    window.dispatchEvent(new CustomEvent("editor:initialized", {
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

  getValue() {
    return this.editor ? this.editor.getValue() : ""
  }

  setValue(code) {
    if (this.editor) this.editor.setValue(code)
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

  dispose() {
    window.removeEventListener("settings:updated", this.boundHandleSettingsUpdate)
    if (this.editor) this.editor.dispose()
    if (this.observer) this.observer.disconnect()
    if (this.saveTimer) clearTimeout(this.saveTimer)
  }
}
