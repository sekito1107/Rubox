import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["container"]

  async connect() {
    try {
      await this.loadEditor()
      this.initEditor()
    } catch (error) {
      this.containerTarget.innerText = "Failed to load editor."
      console.error(error)
    }
  }

  disconnect() {
    if (this.editor) {
      this.editor.dispose()
    }
    if (this.observer) {
      this.observer.disconnect()
    }
  }

  async loadEditor() {
    if (window.monaco) return

    const LOADER_ID = "editor-loader"
    if (document.getElementById(LOADER_ID)) {
      await this.waitForMonaco()
      return
    }

    const LOADER_URL = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.js"
    await this.injectScript(LOADER_URL, LOADER_ID)
    await this.configureAndLoadModule()
  }

  injectScript(src, id) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.id = id
      script.src = src
      script.onload = () => resolve()
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  configureAndLoadModule() {
    return new Promise((resolve) => {
      require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } })
      require(['vs/editor/editor.main'], () => resolve())
    })
  }

  waitForMonaco() {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.monaco) {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  }

  initEditor() {
    this.editor = monaco.editor.create(this.containerTarget, {
      value: [
        "# Welcome to RubPad!",
        "# Type code here and see Rurema links appear on the right.",
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
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace"
    })

    this.observer = new MutationObserver(() => {
      this.updateTheme()
    })
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    })
  }

  updateTheme() {
    if (this.editor) {
      monaco.editor.setTheme(this.currentTheme)
    }
  }

  get currentTheme() {
    const isDark = document.documentElement.classList.contains("dark")
    return isDark ? "vs-dark" : "vs"
  }
}
