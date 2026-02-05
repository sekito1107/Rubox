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

  async download() {
    if (!this.editor) {
      console.warn("Editor not initialized yet")
      return
    }

    const content = this.editor.getValue()

    // 1. File System Access API (Modern Browsers)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'rubpad.rb',
          types: [{
            description: 'Ruby Script',
            accept: { 'text/x-ruby': ['.rb'] },
          }],
        })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        return
      } catch (err) {
        if (err.name === 'AbortError') return // User cancelled
        console.error('SaveFilePicker failed:', err)
        // Fallback to method 2
      }
    }

    // 2. Classic Download (Fallback)
    // ブラウザ設定で「ダウンロード前にファイルの保存場所を確認する」がONならOSダイアログが出る
    const blob = new Blob([content], { type: "text/x-ruby" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "rubpad.rb"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
