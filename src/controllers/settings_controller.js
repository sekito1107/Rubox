import { Controller } from "@hotwired/stimulus"
import { Settings } from "../persistence"

export default class extends Controller {
  static targets = [
    "fontSize", "tabSize", "wordWrap",
    "autoClosingBrackets", "minimap",
    "mouseWheelZoom", "renderWhitespace"
  ]

  connect() {
    this.persistence = new Persistence()
    this.settingsStore = this.persistence.settings
    this.loadSettings()
  }

  loadSettings() {
    this.currentSettings = this.settingsStore.getAll()
    this.updateUI()
    this.applySettings()
  }

  updateUI() {
    if (this.hasFontSizeTarget) this.fontSizeTarget.value = this.currentSettings.fontSize || 14
    if (this.hasTabSizeTarget) this.tabSizeTarget.value = this.currentSettings.tabSize || 2
    if (this.hasWordWrapTarget) this.wordWrapTarget.checked = this.currentSettings.wordWrap === 'on'
    if (this.hasAutoClosingBracketsTarget) this.autoClosingBracketsTarget.checked = this.currentSettings.autoClosingBrackets === 'always'
    if (this.hasMinimapTarget) this.minimapTarget.checked = this.currentSettings.minimap?.enabled
    if (this.hasMouseWheelZoomTarget) this.mouseWheelZoomTarget.checked = this.currentSettings.mouseWheelZoom
    if (this.hasRenderWhitespaceTarget) this.renderWhitespaceTarget.checked = this.currentSettings.renderWhitespace === 'all'
  }

  save() {
    const s = {
      fontSize: this.fontSizeTarget.value,
      tabSize: this.tabSizeTarget.value,
      wordWrap: this.wordWrapTarget.checked ? 'on' : 'off',
      autoClosingBrackets: this.autoClosingBracketsTarget.checked ? 'always' : 'never',
      minimap: { enabled: this.minimapTarget.checked },
      mouseWheelZoom: this.mouseWheelZoomTarget.checked,
      renderWhitespace: this.renderWhitespaceTarget.checked ? 'all' : 'none'
    }

    for (const [k, v] of Object.entries(s)) {
      this.settingsStore.update(k, v)
    }
    this.currentSettings = s
    this.applySettings()
  }

  applySettings() {
    document.documentElement.style.setProperty("--editor-font-size", `${this.currentSettings.fontSize}px`)
    window.dispatchEvent(new CustomEvent("settings:updated", {
      detail: { settings: this.currentSettings }
    }))
  }
}
