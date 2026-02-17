/**
 * エディタ機能 (Vanilla TS Component)
 * editor/index.ts
 */
import * as monaco from 'monaco-editor'
import { Persistence } from './persistence'
import { CodePersistence } from './persistence/code'
import { Settings } from './persistence/settings'
import { DefaultCode } from './examples'

// Vite用にMonaco workerを直接インポート
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// グローバル定義は src/types.d.ts に移動

// 既存のJSロジックをベースに Worker 提供関数を設定
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
  private container: HTMLElement | null
  private settings: Settings
  private codePersistence: CodePersistence
  
  private saveTimer: number | null = null
  private editor: monaco.editor.IStandaloneCodeEditor | null = null
  private boundHandleSettingsUpdate: (event: Event) => void
  private observer: MutationObserver | null = null

  /**
   * @param containerElement - エディタを表示するコンテナ
   * @param persistence - 永続化ドメイン
   */
  constructor(containerElement: HTMLElement | null, persistence: Persistence) {
    this.container = containerElement
    this.settings = persistence.settings
    this.codePersistence = persistence.code
    
    this.initEditor()
    
    // 設定変更イベントの監視 (SettingsComponentからの通知)
    this.boundHandleSettingsUpdate = this.handleSettingsUpdate.bind(this) as EventListener
    window.addEventListener("settings:updated", this.boundHandleSettingsUpdate)
    
    // テーマ監視
    this.observer = new MutationObserver(() => this.updateTheme())
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  }

  private initEditor(): void {
    if (!this.container) return

    const savedSettings = this.settings.getAll()
    const savedCode = this.codePersistence.load()

    this.editor = monaco.editor.create(this.container, {
      model: monaco.editor.createModel(
        savedCode || DefaultCode,
        "ruby",
        monaco.Uri.parse("inmemory:///workspace/main.rb")
      ),
      theme: this.currentTheme,
      automaticLayout: true,
      minimap: savedSettings.minimap || { enabled: false },
      fontSize: parseInt(savedSettings.fontSize || "14"),
      tabSize: parseInt(savedSettings.tabSize || "2"),
      wordWrap: savedSettings.wordWrap || 'off',
      autoClosingBrackets: savedSettings.autoClosingBrackets || 'always',
      mouseWheelZoom: savedSettings.mouseWheelZoom || false,
      renderWhitespace: savedSettings.renderWhitespace || 'none',
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace",
      inlayHints: {
        enabled: "on",
        maximumLength: 150
      }
    })

    // ショートカットキー登録: Ctrl+Enter (Cmd+Enter) で実行
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      window.dispatchEvent(new CustomEvent("rubbit:run-trigger"))
    })

    // グローバルアクセス用 (テスト等で利用)
    window.monacoEditor = this.editor
    window.monaco = monaco

    // コードの永続化
    this.editor.onDidChangeModelContent(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer)
      // window.setTimeout の戻り値は number
      this.saveTimer = window.setTimeout(() => {
        if (this.editor) {
          this.codePersistence.save(this.editor.getValue())
        }
      }, 1000)
    })

    // 初期化完了イベント発火 (依存コンポーネント用)
    window.dispatchEvent(new CustomEvent("editor:initialized", {
      detail: { editor: this.editor },
      bubbles: true 
    }))
  }

  private updateTheme(): void {
    if (this.editor) monaco.editor.setTheme(this.currentTheme)
  }

  private get currentTheme(): string {
    return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs"
  }

  public getValue(): string {
    return this.editor ? this.editor.getValue() : ""
  }

  public setValue(code: string): void {
    if (this.editor) this.editor.setValue(code)
  }

  private handleSettingsUpdate(event: Event): void {
    if (!this.editor) return
    const customEvent = event as CustomEvent
    const s = customEvent.detail.settings
    
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

  public dispose(): void {
    window.removeEventListener("settings:updated", this.boundHandleSettingsUpdate)
    if (this.editor) this.editor.dispose()
    if (this.observer) this.observer.disconnect()
    if (this.saveTimer) clearTimeout(this.saveTimer)
  }
}
