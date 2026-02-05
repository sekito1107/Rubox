import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.editor = null
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  handleEditorInit(event) {
    this.editor = event.detail.editor
  }

  download() {
    if (!this.editor) {
      console.warn("Editor not initialized yet")
      // フォールバック: もしエディタ参照がない場合、localStorageから取る手もあるが、今回は警告のみ
      return
    }

    const content = this.editor.getValue()
    const blob = new Blob([content], { type: "text/x-ruby" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "main.rb"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
