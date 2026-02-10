/**
 * トーストコンポーネント
 * toast/index.js
 */
export class ToastComponent {
  /**
   * @param {HTMLElement} containerElement - トーストコンテナ
   */
  constructor(containerElement) {
    this.container = containerElement
    this.timeout = null
    
    // UI参照
    this.messageElement = this.container.querySelector('[data-toast="message"]')
    this.iconContainer = this.container.querySelector('[data-toast="icon"]')
    this.closeButton = this.container.querySelector('[data-toast="close"]')
    
    // メソッドのバインド
    this.boundShow = this.show.bind(this)
    this.boundHide = this.hide.bind(this)

    // グローバルトーストイベントを監視
    window.addEventListener("show-toast", this.boundShow)
    
    // Close button
    if (this.closeButton) {
      this.closeButton.addEventListener("click", this.boundHide)
    }
  }

  show(event) {
    const { message, type = "success", duration = 3000 } = event.detail
    
    // メッセージ設定
    if (this.messageElement) {
      this.messageElement.textContent = message
    }
    
    // アイコン切り替え
    this.updateIcon(type)
    
    // 表示アニメーション
    // hiddenClasses: translate-y-[-100%] opacity-0 pointer-events-none
    // visibleClasses: translate-y-0 opacity-100
    this.container.classList.remove("translate-y-[-100%]", "opacity-0", "pointer-events-none")
    this.container.classList.add("translate-y-0", "opacity-100")

    // 自動非表示タイマー
    if (this.timeout) clearTimeout(this.timeout)
    if (duration > 0) {
      this.timeout = setTimeout(() => {
        this.hide()
      }, duration)
    }
  }

  hide() {
    this.container.classList.remove("translate-y-0", "opacity-100")
    this.container.classList.add("translate-y-[-100%]", "opacity-0", "pointer-events-none")
  }

  updateIcon(type) {
    if (!this.iconContainer) return
    
    // アイコンの表示/非表示を切り替え
    this.iconContainer.querySelectorAll("svg").forEach(icon => {
      if (icon.dataset.type === type) {
        icon.classList.remove("hidden")
      } else {
        icon.classList.add("hidden")
      }
    })
  }
}
