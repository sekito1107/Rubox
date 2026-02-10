import * as monaco from 'monaco-editor'

/**
 * LSP からの診断情報を購読し、エディタに表示する
 */
export class HandleDiagnostics {
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    this.debounceTimer = null
  }

  /**
   * 通知の監視を開始する
   */
  start() {
    // 1. 標準的な診断通知
    this.client.onNotification("textDocument/publishDiagnostics", (params) => {
      const markers = params.diagnostics
        .filter(diag => {
          if (!diag || !diag.message) return true;
          const msgLower = String(diag.message).toLowerCase();
          
          // タイププロフの誤報フィルタリング
          const isFalsePositive = (
            msgLower.includes("failed to resolve overload") ||
            msgLower.includes("object#puts") ||
            msgLower.includes("object#print") ||
            msgLower.includes("kernel#puts") ||
            msgLower.includes("kernel#print") ||
            msgLower.includes("::_tos")
          );

          return !isFalsePositive;
        })
        .map(diag => ({
          severity: this.mapSeverity(diag.severity),
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "TypeProf"
        }))
      
      const currentModel = this.editor.getModel();
      if (currentModel) {
        monaco.editor.setModelMarkers(currentModel, "lsp", markers)
        
        // 解析完了を通知 (負荷軽減のためデバウンス)
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => {
          window.dispatchEvent(new CustomEvent("rubpad:lsp-analysis-finished"))
        }, 100)
      }
    })

    // 2. カスタムの構文チェック
    this.client.onNotification("rubpad/syntaxCheck", (params) => {
      const model = this.editor.getModel()
      if (!model) return

      if (params.valid) {
        monaco.editor.setModelMarkers(model, "ruby-syntax", [])
      } else {
        const markers = params.diagnostics.map(diag => ({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "RubySyntax"
        }))
        monaco.editor.setModelMarkers(model, "ruby-syntax", markers)
      }
    })
  }

  mapSeverity(lspSeverity) {
    switch (lspSeverity) {
      case 1: return monaco.MarkerSeverity.Error
      case 2: return monaco.MarkerSeverity.Warning
      case 3: return monaco.MarkerSeverity.Info
      case 4: return monaco.MarkerSeverity.Hint
      default: return monaco.MarkerSeverity.Info
    }
  }
}
