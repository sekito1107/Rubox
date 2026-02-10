import { Controller } from "@hotwired/stimulus"
import { Share } from "persistence/share"

/**
 * 共有機能を担当するコントローラー
 */
export default class extends Controller {
  connect() {
    this.editor = null
    this.persistence = new Persistence()
    this.shareService = this.persistence.share
    this.boundHandleEditorInit = (e) => {
      this.editor = e.detail.editor
      this.restoreFromUrl()
    }
    document.addEventListener("editor:initialized", this.boundHandleEditorInit)
  }

  disconnect() {
    document.removeEventListener("editor:initialized", this.boundHandleEditorInit)
  }

  share() {
    if (!this.editor) return

    const code = this.editor.getValue()
    try {
      const url = this.shareService.compress(code)
      // Update current URL hash for the test
      window.location.hash = new URL(url).hash
      navigator.clipboard.writeText(url)
      this.dispatchToast("URL copied to clipboard!", "success")
    } catch (err) {
      this.dispatchToast("Failed to share code", "error")
    }
  }

  restoreFromUrl() {
    if (!this.editor) return
    const hash = window.location.hash.substring(1)
    if (!hash) return

    const code = this.shareService.decompress(hash)
    if (code) {
      this.editor.setValue(code)
      // Consume the hash once restored
      history.replaceState(null, "", window.location.pathname + window.location.search)
    }
  }

  dispatchToast(message, type = "success") {
    window.dispatchEvent(new CustomEvent("show-toast", {
      detail: { message, type },
      bubbles: true
    }))
  }
}
