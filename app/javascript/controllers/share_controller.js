import { Controller } from "@hotwired/stimulus"
import UrlCompressor from "utils/url_compressor"

// 共有機能を担当するコントローラー
// - Share ボタンクリック時: コードを圧縮してURLハッシュに設定し、クリップボードにコピー
// - ページロード時: URLハッシュがあればコードを復元してエディタにセット
//
// TODO: restoreFromUrl は Share ボタンの存在に依存している。
//       将来的に複数ページ構成になった場合は、ルートレベルのコントローラーに移動すること。
export default class extends Controller {
  connect() {
    this.editor = null
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  disconnect() {
    // イベントリスナーを解除してメモリリークを防ぐ
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  handleEditorInit(event) {
    this.editor = event.detail.editor
    this.restoreFromUrl()
  }

  async share() {
    if (!this.editor) return

    const code = this.editor.getValue()
    if (!code.trim()) {
      this.dispatchToast("No code to share", "error")
      return
    }

    try {
      const compressed = UrlCompressor.compress(code)
      const newUrl = new URL(window.location.href)
      newUrl.hash = `code=${compressed}`
      window.history.replaceState({}, "", newUrl.toString())

      await navigator.clipboard.writeText(newUrl.toString())
      
      this.dispatchToast("URL copied to clipboard!", "success")
      
    } catch (err) {
      console.error("共有処理でエラーが発生しました:", err)
      this.dispatchToast("Failed to copy URL", "error")
    }
  }

  restoreFromUrl() {
    const hash = window.location.hash
    if (!hash || !hash.startsWith("#code=")) return

    const compressed = hash.slice(6)
    if (!compressed) return

    try {
      const code = UrlCompressor.decompress(compressed)
      if (code && this.editor) {
        this.editor.setValue(code)
        // persistence_controller と同じキーを使用
        localStorage.setItem("rubpad_content", code)
      }
    } catch (err) {
      console.error("URLからのコード復元に失敗しました:", err)
    } finally {
      // 復元成功・失敗に関わらず、URLハッシュをクリアする (Consume-once)
      // これにより、ユーザーが編集後にリロードしても
      // LocalStorageの内容 (persistence_controller) が優先されるようになる
      const urlObj = new URL(window.location.href)
      urlObj.hash = ""
      window.history.replaceState({}, "", urlObj.toString())
    }
  }

  dispatchToast(message, type = "success") {
    const event = new CustomEvent("show-toast", {
      detail: { message, type },
      bubbles: true,
      cancelable: true
    })
    window.dispatchEvent(event)
  }
}
