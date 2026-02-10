/**
 * Monaco Editor の内容を LSP サーバと同期する
 */
export class SyncDocument {
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    this.model = editor.getModel()
    this.debounceTimer = null
    this.DEBOUNCE_WAIT = 500
  }

  /**
   * 文書の同期を初期化する (didOpen)
   */
  start() {
    if (!this.model) return

    const content = this.model.getValue()
    const version = this.model.getVersionId()

    this.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: "inmemory:///workspace/main.rb",
        languageId: "ruby",
        version: version,
        text: content
      }
    })

    this.subscribeToChanges()
  }

  /**
   * エディタの変更監視を開始する
   */
  subscribeToChanges() {
    this.editor.onDidChangeModelContent(() => {
      this.isDirty = true
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.flush(), this.DEBOUNCE_WAIT)
    })
  }

  /**
   * Pending 中の変更を即座に同期する (didChange)
   */
  flush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (!this.model || !this.isDirty) return
    this.isDirty = false

    const content = this.model.getValue()
    const version = this.model.getVersionId()

    this.client.sendNotification("textDocument/didChange", {
      textDocument: { uri: "inmemory:///workspace/main.rb", version: version },
      contentChanges: [{ text: content }]
    })
  }

  /**
   * 一時的な解析（プローブ）のためにコンテンツを一時的に変更する
   */
  async sendTemporaryContent(tempContent) {
    const version = this.model.getVersionId() + 1
    this.client.sendNotification("textDocument/didChange", {
      textDocument: { uri: "inmemory:///workspace/main.rb", version: version },
      contentChanges: [{ text: tempContent }]
    })
  }

  /**
   * オリジナルのコンテンツを再同期して復元する
   */
  async restoreOriginalContent() {
    this.flush()
  }
}
