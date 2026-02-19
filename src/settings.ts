// 設定コンポーネント
// settings/index.ts
import { Persistence } from "./persistence";
import { Settings } from "./persistence/settings";

interface SettingsElements {
  fontSize: HTMLInputElement | null;
  tabSize: HTMLInputElement | null;
  wordWrap: HTMLInputElement | null;
  autoClosingBrackets: HTMLInputElement | null;
  minimap: HTMLInputElement | null;
  mouseWheelZoom: HTMLInputElement | null;
  renderWhitespace: HTMLInputElement | null;
}

export class SettingsComponent {
  private container: HTMLElement;
  private settingsStore: Settings;
  private elements: SettingsElements;
  private currentSettings: Record<string, any>;

  // containerElement: 設定を含むコンテナ (通常はModal)
  // persistence: 永続化ドメイン
  constructor(containerElement: HTMLElement, persistence: Persistence) {
    this.container = containerElement;
    this.settingsStore = persistence.settings;
    
    // UI要素のマップ
    this.elements = {
      fontSize: this.container.querySelector<HTMLInputElement>('[data-setting="fontSize"]'),
      tabSize: this.container.querySelector<HTMLInputElement>('[data-setting="tabSize"]'),
      wordWrap: this.container.querySelector<HTMLInputElement>('[data-setting="wordWrap"]'),
      autoClosingBrackets: this.container.querySelector<HTMLInputElement>('[data-setting="autoClosingBrackets"]'),
      minimap: this.container.querySelector<HTMLInputElement>('[data-setting="minimap"]'),
      mouseWheelZoom: this.container.querySelector<HTMLInputElement>('[data-setting="mouseWheelZoom"]'),
      renderWhitespace: this.container.querySelector<HTMLInputElement>('[data-setting="renderWhitespace"]')
    };

    this.currentSettings = {};
    
    this.init();
  }

  private init(): void {
    this.loadSettings();
    this.bindEvents();
  }

  private loadSettings(): void {
    this.currentSettings = this.settingsStore.getAll();
    this.updateUI();
    this.applySettings();
  }

  private updateUI(): void {
    const s = this.currentSettings;
    if (this.elements.fontSize) this.elements.fontSize.value = String(s.fontSize || 14);
    if (this.elements.tabSize) this.elements.tabSize.value = String(s.tabSize || 2);
    if (this.elements.wordWrap) this.elements.wordWrap.checked = s.wordWrap === 'on';
    if (this.elements.autoClosingBrackets) this.elements.autoClosingBrackets.checked = s.autoClosingBrackets === 'always';
    if (this.elements.minimap) this.elements.minimap.checked = !!s.minimap?.enabled;
    if (this.elements.mouseWheelZoom) this.elements.mouseWheelZoom.checked = !!s.mouseWheelZoom;
    if (this.elements.renderWhitespace) this.elements.renderWhitespace.checked = s.renderWhitespace === 'all';
  }

  private bindEvents(): void {
    Object.values(this.elements).forEach(el => {
      if (el) {
        el.addEventListener("change", () => this.save());
      }
    });
  }

  public save(): void {
    const s = {
      fontSize: this.elements.fontSize ? parseInt(this.elements.fontSize.value, 10) : undefined,
      tabSize: this.elements.tabSize ? parseInt(this.elements.tabSize.value, 10) : undefined,
      wordWrap: this.elements.wordWrap?.checked ? 'on' : 'off',
      autoClosingBrackets: this.elements.autoClosingBrackets?.checked ? 'always' : 'never',
      minimap: { enabled: this.elements.minimap?.checked },
      mouseWheelZoom: this.elements.mouseWheelZoom?.checked,
      renderWhitespace: this.elements.renderWhitespace?.checked ? 'all' : 'none'
    };

    for (const [k, v] of Object.entries(s)) {
      if (v !== undefined) {
        this.settingsStore.update(k, v);
      }
    }
    this.currentSettings = s;
    this.applySettings();
  }

  private applySettings(): void {
    if (this.currentSettings.fontSize) {
      document.documentElement.style.setProperty("--editor-font-size", `${this.currentSettings.fontSize}px`);
    }
    window.dispatchEvent(new CustomEvent("settings:updated", {
      detail: { settings: this.currentSettings }
    }));
  }
}
