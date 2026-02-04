import { Controller } from "@hotwired/stimulus"

// ダークモード切り替えコントローラー
export default class extends Controller {
  connect() {
    this.updateIcon()
  }

  toggle() {
    const isDark = document.documentElement.classList.toggle("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
    this.updateIcon()
  }

  updateIcon() {
    // アイコンの表示はCSSのdark:hiddenで制御されるため、特に処理不要
  }
}
