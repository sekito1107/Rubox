import { Controller } from "@hotwired/stimulus"

// 汎用トースト通知コントローラー
// - windowの `show-toast` イベントを監視して通知を表示
// - `type` によりアイコンを切り替え (success, error)
// - `duration` ミリ秒後に自動で非表示
export default class extends Controller {
  static targets = ["container", "message", "icon"]
  static classes = ["hidden", "visible"]

  connect() {
    this.timeout = null
  }

  show(event) {
    const { message, type = "success", duration = 3000 } = event.detail
    
    // メッセージ設定
    this.messageTarget.textContent = message
    
    // アイコン切り替え
    this.updateIcon(type)
    
    // 表示アニメーション
    this.element.classList.remove(...this.hiddenClasses)
    this.element.classList.add(...this.visibleClasses)
    this.element.classList.remove("pointer-events-none")

    // 自動非表示タイマー
    if (this.timeout) clearTimeout(this.timeout)
    if (duration > 0) {
      this.timeout = setTimeout(() => {
        this.hide()
      }, duration)
    }
  }

  hide() {
    this.element.classList.remove(...this.visibleClasses)
    this.element.classList.add(...this.hiddenClasses)
  }

  updateIcon(type) {
    // アイコンの表示/非表示を切り替え
    this.iconTarget.querySelectorAll("svg").forEach(icon => {
      if (icon.dataset.type === type) {
        icon.classList.remove("hidden")
      } else {
        icon.classList.add("hidden")
      }
    })
  }
}
