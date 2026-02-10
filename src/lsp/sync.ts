import type * as monaco from 'monaco-editor';
import type { LSPClient } from './client';

/**
 * Monaco Editor の内容を LSP サーバと同期する
 */
export class SyncDocument {
  private client: LSPClient;
  private editor: monaco.editor.ICodeEditor;
  private model: monaco.editor.ITextModel | null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private DEBOUNCE_WAIT: number = 500;
  private isDirty: boolean = false;

  constructor(client: LSPClient, editor: monaco.editor.ICodeEditor) {
    this.client = client;
    this.editor = editor;
    this.model = editor.getModel();
  }

  /**
   * 文書の同期を初期化する (didOpen)
   */
  start(): void {
    if (!this.model) return;

    const content = this.model.getValue();
    const version = this.model.getVersionId();

    this.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: "inmemory:///workspace/main.rb",
        languageId: "ruby",
        version: version,
        text: content
      }
    });

    this.subscribeToChanges();
  }

  /**
   * エディタの変更監視を開始する
   */
  subscribeToChanges(): void {
    this.editor.onDidChangeModelContent(() => {
      this.isDirty = true;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.flush(), this.DEBOUNCE_WAIT);
    });
  }

  /**
   * Pending 中の変更を即座に同期する (didChange)
   */
  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!this.model || !this.isDirty) return;
    this.isDirty = false;

    const content = this.model.getValue();
    const version = this.model.getVersionId();

    this.client.sendNotification("textDocument/didChange", {
      textDocument: { uri: "inmemory:///workspace/main.rb", version: version },
      contentChanges: [{ text: content }]
    });
  }

  /**
   * 一時的な解析（プローブ）のためにコンテンツを一時的に変更する
   */
  async sendTemporaryContent(tempContent: string): Promise<void> {
    if (!this.model) return;
    const version = this.model.getVersionId() + 1;
    this.client.sendNotification("textDocument/didChange", {
      textDocument: { uri: "inmemory:///workspace/main.rb", version: version },
      contentChanges: [{ text: tempContent }]
    });
  }

  /**
   * オリジナルのコンテンツを再同期して復元する
   */
  async restoreOriginalContent(): Promise<void> {
    this.flush();
  }
}
