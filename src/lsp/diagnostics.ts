import * as monaco from 'monaco-editor';
import type { LSPClient } from './client';

interface DiagnosticsParams {
  diagnostics: Array<{
    severity: number;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
  }>;
}

interface SyntaxCheckParams {
  valid: boolean;
  diagnostics: Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
  }>;
}

/**
 * LSP からの診断情報を購読し、エディタに表示する
 */
export class HandleDiagnostics {
  private client: LSPClient;
  private editor: monaco.editor.ICodeEditor;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: LSPClient, editor: monaco.editor.ICodeEditor) {
    this.client = client;
    this.editor = editor;
  }

  /**
   * 通知の監視を開始する
   */
  start(): void {
    // 1. 標準的な診断通知
    this.client.onNotification("textDocument/publishDiagnostics", (params: DiagnosticsParams) => {
      const markers: monaco.editor.IMarkerData[] = params.diagnostics
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
        }));
      
      const currentModel = this.editor.getModel();
      if (currentModel) {
        monaco.editor.setModelMarkers(currentModel, "lsp", markers);
        
        // 解析完了を通知 (負荷軽減のためデバウンス)
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          window.dispatchEvent(new CustomEvent("rubpad:lsp-analysis-finished"));
        }, 100);
      }
    });

    // 2. カスタムの構文チェック
    this.client.onNotification("rubpad/syntaxCheck", (params: SyntaxCheckParams) => {
      const model = this.editor.getModel();
      if (!model) return;

      if (params.valid) {
        monaco.editor.setModelMarkers(model, "ruby-syntax", []);
      } else {
        const markers: monaco.editor.IMarkerData[] = params.diagnostics.map(diag => ({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "RubySyntax"
        }));
        monaco.editor.setModelMarkers(model, "ruby-syntax", markers);
      }
    });
  }

  private mapSeverity(lspSeverity: number): monaco.MarkerSeverity {
    switch (lspSeverity) {
      case 1: return monaco.MarkerSeverity.Error;
      case 2: return monaco.MarkerSeverity.Warning;
      case 3: return monaco.MarkerSeverity.Info;
      case 4: return monaco.MarkerSeverity.Hint;
      default: return monaco.MarkerSeverity.Info;
    }
  }
}
