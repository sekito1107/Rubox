import { Controller } from "@hotwired/stimulus"

// ダークモード切り替えコントローラー
export default class extends Controller {
  connect() {
    console.log("Theme controller connected")
    this.updateIcon()
  }

  toggle() {
    console.log("Toggle called!")
    const isDark = document.documentElement.classList.toggle("dark")
    console.log("Dark mode:", isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
    this.updateIcon()
  }

  updateIcon() {
    // アイコンの表示はCSSのdark:hiddenで制御されるため、特に処理不要
  }
}
