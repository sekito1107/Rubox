/**
 * エディタのコード内容を LocalStorage に保存・復元する
 */
export class CodePersistence {
  static STORAGE_KEY = "rubpad_code"

  /**
   * コードを保存する
   */
  save(code) {
    if (code === undefined || code === null) return
    localStorage.setItem(CodePersistence.STORAGE_KEY, code)
  }

  /**
   * 保存されたコードを読み込む
   */
  load() {
    try {
      return localStorage.getItem(CodePersistence.STORAGE_KEY)
    } catch (e) {
      console.warn("[CodePersistence] Failed to load code:", e)
      return null
    }
  }

  /**
   * 保存されたコードを削除する
   */
  clear() {
    localStorage.removeItem(CodePersistence.STORAGE_KEY)
  }
}
