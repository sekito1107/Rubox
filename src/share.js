/**
 * コード共有機能
 * share/index.js
 */
export class ShareComponent {
  /**
   * @param {HTMLElement} buttonElement - Shareボタン
   * @param {EditorComponent} editorComponent - エディタコンポーネント (getValue/setValue用)
   * @param {Share} shareService - 共有ロジック (Persistence.share)
   */
  constructor(buttonElement, editorComponent, shareService) {
    this.button = buttonElement
    this.editor = editorComponent
    this.service = shareService

    if (this.button) {
      this.button.addEventListener("click", () => this.share())
    }

    // 初期化時にURLからコードを復元
    this.restoreFromUrl()
  }

  share() {
    const code = this.editor.getValue()
    try {
      const url = this.service.compress(code)
      // テスト用に現在のURLハッシュを更新
      window.location.hash = new URL(url).hash
      navigator.clipboard.writeText(url)
      
      this.dispatchToast("URL copied to clipboard!", "success")
    } catch (err) {
      console.error(err)
      this.dispatchToast("Failed to share code", "error")
    }
  }

  restoreFromUrl() {
    const hash = window.location.hash.substring(1)
    if (!hash) return

    const code = this.service.decompress(hash)
    if (code) {
      this.editor.setValue(code)
      // 一度復元したらハッシュを削除
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
