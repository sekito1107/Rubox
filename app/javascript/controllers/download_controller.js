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
      return
    }

    let filename = prompt("保存するファイル名を入力してください", "main.rb")
    if (filename === null) return // キャンセル
    
    // 空入力の場合はデフォルトに戻す、あるいは警告？今回はデフォルトにする
    if (!filename.trim()) {
      filename = "main.rb"
    }

    // 拡張子 .rb を補完
    if (!filename.endsWith(".rb")) {
      filename += ".rb"
    }

    const content = this.editor.getValue()
    const blob = new Blob([content], { type: "text/x-ruby" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
