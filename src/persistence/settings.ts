// エディタ設定等の LocalStorage への保存と復元を担当する
export class Settings {
  static readonly STORAGE_KEY = "rubox_settings"
  private data: Record<string, any>

  constructor() {
    this.data = this._load()
  }

  // 全ての設定を取得
  getAll(): Record<string, any> {
    return this.data
  }

  // 特定のキーの設定を更新
  update(key: string, value: any): void {
    this.data[key] = value
    this._save()
  }

  private _load(): Record<string, any> {
    try {
      const stored = localStorage.getItem(Settings.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (e) {
      console.warn("[Settings] Failed to load settings:", e)
      return {}
    }
  }

  private _save(): void {
    localStorage.setItem(Settings.STORAGE_KEY, JSON.stringify(this.data))
  }
}
