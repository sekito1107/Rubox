/**
 * 設定コンポーネント
 * settings/index.js
 */
export class SettingsComponent {
  /**
   * @param {HTMLElement} containerElement - 設定を含むコンテナ (通常はModal)
   * @param {Persistence} persistence - 永続化ドメイン
   */
  constructor(containerElement, persistence) {
    this.container = containerElement
    this.settingsStore = persistence.settings
    
    // UI要素のマップ
    this.elements = {
      fontSize: this.container.querySelector('[data-setting="fontSize"]'),
      tabSize: this.container.querySelector('[data-setting="tabSize"]'),
      wordWrap: this.container.querySelector('[data-setting="wordWrap"]'),
      autoClosingBrackets: this.container.querySelector('[data-setting="autoClosingBrackets"]'),
      minimap: this.container.querySelector('[data-setting="minimap"]'),
      mouseWheelZoom: this.container.querySelector('[data-setting="mouseWheelZoom"]'),
      renderWhitespace: this.container.querySelector('[data-setting="renderWhitespace"]')
    }

    this.currentSettings = {}
    
    this.init()
  }

  init() {
    this.loadSettings()
    this.bindEvents()
  }

  loadSettings() {
    this.currentSettings = this.settingsStore.getAll()
    this.updateUI()
    this.applySettings()
  }

  updateUI() {
    const s = this.currentSettings
    if (this.elements.fontSize) this.elements.fontSize.value = s.fontSize || 14
    if (this.elements.tabSize) this.elements.tabSize.value = s.tabSize || 2
    if (this.elements.wordWrap) this.elements.wordWrap.checked = s.wordWrap === 'on'
    if (this.elements.autoClosingBrackets) this.elements.autoClosingBrackets.checked = s.autoClosingBrackets === 'always'
    if (this.elements.minimap) this.elements.minimap.checked = s.minimap?.enabled
    if (this.elements.mouseWheelZoom) this.elements.mouseWheelZoom.checked = s.mouseWheelZoom
    if (this.elements.renderWhitespace) this.elements.renderWhitespace.checked = s.renderWhitespace === 'all'
  }

  bindEvents() {
    // Listen for changes on all managed inputs
    Object.values(this.elements).forEach(el => {
      if (el) {
        el.addEventListener("change", () => this.save())
      }
    })
  }

  save() {
    const s = {
      fontSize: this.elements.fontSize?.value,
      tabSize: this.elements.tabSize?.value,
      wordWrap: this.elements.wordWrap?.checked ? 'on' : 'off',
      autoClosingBrackets: this.elements.autoClosingBrackets?.checked ? 'always' : 'never',
      minimap: { enabled: this.elements.minimap?.checked },
      mouseWheelZoom: this.elements.mouseWheelZoom?.checked,
      renderWhitespace: this.elements.renderWhitespace?.checked ? 'all' : 'none'
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
