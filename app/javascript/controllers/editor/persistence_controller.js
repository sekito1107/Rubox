import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.element.addEventListener("editor--main:initialized", this.setupPersistence.bind(this))
  }

  setupPersistence(event) {
    this.editor = event.detail.editor
    this.loadContent()
    
    // Save on change (debounced)
    const debouncedSave = this.debounce((content) => {
      this.saveContent(content)
    }, 1000)

    this.editor.onDidChangeModelContent(() => {
      debouncedSave(this.editor.getValue())
    })
  }

  loadContent() {
    // URLハッシュがある場合は share_controller に任せるためスキップ
    if (window.location.hash.startsWith("#code=")) return
    
    const savedContent = localStorage.getItem("rubpad_content")
    if (savedContent) {
      this.editor.setValue(savedContent)
    }
  }

  saveContent(content) {
    localStorage.setItem("rubpad_content", content)
  }

  debounce(func, wait) {
    let timeout
    return function(...args) {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), wait)
    }
  }
}
