/**
 * エディタのコード内容を LocalStorage に保存・復元する
 */
export class CodePersistence {
  static readonly STORAGE_KEY = "rubpad_code"

  /**
   * コードを保存する
   */
  save(code: string | null | undefined): void {
    if (code === undefined || code === null) return
    localStorage.setItem(CodePersistence.STORAGE_KEY, code)
  }

  /**
   * 保存されたコードを読み込む
   */
  load(): string | null {
    try {
      return localStorage.getItem(CodePersistence.STORAGE_KEY)
    } catch (e) {
      console.warn("[CodePersistence] Failed to load code:", e)
      return null
    }
  }
}
