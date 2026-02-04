import { Controller } from "@hotwired/stimulus"
import { DefaultRubyVM } from "@ruby/wasm-wasi"

export default class extends Controller {
  static targets = ["output"]
  
  async connect() {
    this.editor = null
    this.vm = null
    this.outputLines = []
    
    // Listen for editor initialization
    document.addEventListener("editor--main:initialized", (e) => {
      this.editor = e.detail.editor
    })
    
    // Initialize Ruby VM in the background
    this.initializeVM()
  }

  async initializeVM() {
    try {
      this.updateOutput("// Ruby WASM initializing...")
      
      const response = await fetch(
        "https://cdn.jsdelivr.net/npm/@ruby/3.3-wasm-wasi@2.6.0/dist/ruby+stdlib.wasm"
      )
      const module = await WebAssembly.compileStreaming(response)
      const { vm } = await DefaultRubyVM(module)
      
      this.vm = vm
      this.updateOutput("// Ruby WASM ready! Click Run to execute code.")
    } catch (error) {
      console.error("Failed to initialize Ruby VM:", error)
      this.updateOutput(`// Error: Failed to initialize Ruby VM: ${error.message}`)
    }
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
    this.outputLines = []
    
    try {
      // Capture stdout by wrapping in a StringIO
      const wrappedCode = `
        require 'stringio'
        $stdout = StringIO.new
        begin
          ${code}
        rescue => e
          puts "Error: \#{e.class}: \#{e.message}"
        end
        $stdout.string
      `
      
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
