import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "fontSize", "tabSize", "wordWrap",
    "autoClosingBrackets", "minimap",
    "mouseWheelZoom", "renderWhitespace"
  ]

  connect() {
    this.loadSettings()
  }

  loadSettings() {
    const defaultSettings = {
      fontSize: "14",
      tabSize: "2",
      wordWrap: "off",
      autoClosingBrackets: "always",
      minimap: { enabled: false },
      mouseWheelZoom: false,
      renderWhitespace: "none"
    }

    try {
      const json = localStorage.getItem("rubpad_settings")
      this.settings = json ? { ...defaultSettings, ...JSON.parse(json) } : defaultSettings
    } catch (e) {
      console.error("Failed to load settings:", e)
      this.settings = defaultSettings
    }

    this.updateUI()
    this.applySettings()
  }

  updateUI() {
    if (this.hasFontSizeTarget) this.fontSizeTarget.value = this.settings.fontSize
    if (this.hasTabSizeTarget) this.tabSizeTarget.value = this.settings.tabSize
    if (this.hasWordWrapTarget) this.wordWrapTarget.checked = this.settings.wordWrap === 'on'
    if (this.hasAutoClosingBracketsTarget) this.autoClosingBracketsTarget.checked = this.settings.autoClosingBrackets === 'always'
    if (this.hasMinimapTarget) this.minimapTarget.checked = this.settings.minimap.enabled
    if (this.hasMouseWheelZoomTarget) this.mouseWheelZoomTarget.checked = this.settings.mouseWheelZoom
    if (this.hasRenderWhitespaceTarget) this.renderWhitespaceTarget.checked = this.settings.renderWhitespace === 'all'
  }

  save() {
    this.settings = {
      fontSize: this.fontSizeTarget.value,
      tabSize: this.tabSizeTarget.value,
      wordWrap: this.wordWrapTarget.checked ? 'on' : 'off',
      autoClosingBrackets: this.autoClosingBracketsTarget.checked ? 'always' : 'never',
      minimap: { enabled: this.minimapTarget.checked },
      mouseWheelZoom: this.mouseWheelZoomTarget.checked,
      renderWhitespace: this.renderWhitespaceTarget.checked ? 'all' : 'none'
    }

    try {
      localStorage.setItem("rubpad_settings", JSON.stringify(this.settings))
    } catch (e) {
      console.error("Failed to save settings:", e)
    }

    this.applySettings()
  }

  applySettings() {
    // 1. CSS変数 (フォントサイズ用)
    document.documentElement.style.setProperty("--editor-font-size", `${this.settings.fontSize}px`)

    // 2. エディタ設定 (イベント通知)
    window.dispatchEvent(new CustomEvent("settings:updated", {
      detail: { settings: this.settings }
    }))
  }
}
