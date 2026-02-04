import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["container"]

  async connect() {
    try {
      await this.loadEditor()
      this.initEditor()
    } catch (error) {
      // Create a fallback error message in the editor container
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

  loadEditor() {
    return new Promise((resolve, reject) => {
      // Check if global object exists
      if (window.monaco) {
        resolve()
        return
      }

      // Check if loader is already added
      if (document.getElementById("editor-loader")) {
        // Poll for completion
        const check = setInterval(() => {
          if (window.monaco) {
            clearInterval(check)
            resolve()
          }
        }, 100)
        return
      }

      const LOADER_URL = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.js"
      
      const script = document.createElement("script")
      script.id = "editor-loader"
      script.src = LOADER_URL
      script.onload = () => {
        // Configure loader
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
        
        // Load the editor module
        require(['vs/editor/editor.main'], () => {
          resolve()
        });
      }
      script.onerror = reject
      document.head.appendChild(script)
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

    // Theme observer
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
