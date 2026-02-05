import { Controller } from "@hotwired/stimulus"
import UrlCompressor from "utils/url_compressor"

// 共有機能を担当するコントローラー
// - Share ボタンクリック時: コードを圧縮してURLハッシュに設定し、クリップボードにコピー
// - ページロード時: URLハッシュがあればコードを復元してエディタにセット
export default class extends Controller {
  connect() {
    this.editor = null

    // エディタの初期化を監視
    document.addEventListener("editor--main:initialized", (e) => {
      this.editor = e.detail.editor
      this.restoreFromUrl()
    })
  }

  // Shareボタンがクリックされたときの処理
  async share() {
    if (!this.editor) {
      console.warn("エディタが初期化されていません")
      return
    }

    const code = this.editor.getValue()
    if (!code.trim()) {
      console.warn("共有するコードがありません")
      return
    }

    // コードを圧縮してURLセーフな文字列に変換
    const compressed = UrlCompressor.compress(code)

    // URLハッシュを更新
    const newUrl = new URL(window.location.href)
    newUrl.hash = `code=${compressed}`
    window.history.replaceState({}, "", newUrl.toString())

    // クリップボードにコピー
    try {
      await navigator.clipboard.writeText(newUrl.toString())
      this.showNotification("URL copied to clipboard!")
    } catch (err) {
      console.error("クリップボードへのコピーに失敗しました:", err)
      this.showNotification("Failed to copy URL", true)
    }
  }

  // URLハッシュからコードを復元
  restoreFromUrl() {
    const hash = window.location.hash
    if (!hash || !hash.startsWith("#code=")) {
      return
    }

    const compressed = hash.slice(6) // "#code=" を除去
    if (!compressed) {
      return
    }

    try {
      const code = UrlCompressor.decompress(compressed)
      if (code && this.editor) {
        this.editor.setValue(code)
        // URLハッシュからの復元時は LocalStorage より優先されるべきなので、
        // persistence_controller との競合を避けるため、復元後に localStorage も更新
        localStorage.setItem("rubpad_code", code)
      }
    } catch (err) {
      console.error("URLからのコード復元に失敗しました:", err)
    }
  }

  // 通知表示（簡易実装）
  showNotification(message, isError = false) {
    // 既存の通知があれば削除
    const existing = document.querySelector(".share-notification")
    if (existing) existing.remove()

    const notification = document.createElement("div")
    notification.className = `share-notification fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium shadow-lg z-50 ${
      isError 
        ? "bg-red-500 text-white" 
        : "bg-green-500 text-white"
    }`
    notification.textContent = message
    document.body.appendChild(notification)

    // 3秒後に非表示
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }
}
