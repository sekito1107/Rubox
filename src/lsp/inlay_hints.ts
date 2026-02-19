import * as monaco from 'monaco-editor';

// Monaco Editor に Inlay Hints (型情報の行末表示) を提供する
export class ProvideInlayHints {
  private editor: monaco.editor.ICodeEditor;
  private emitter: monaco.Emitter<void> = new monaco.Emitter<void>();
  private measuredValues: Map<number, string> = new Map();

  constructor(editor: monaco.editor.ICodeEditor) {
    this.editor = editor;
  }

  // プロバイダを登録する
  start(): void {
    monaco.languages.registerInlayHintsProvider("ruby", {
      onDidChangeInlayHints: this.emitter.event,
      provideInlayHints: (model: monaco.editor.ITextModel, range: monaco.Range) => {
        const hints: monaco.languages.InlayHint[] = [];
        try {
          for (const [line, value] of this.measuredValues.entries()) {
            const lineNum = Number(line);
            if (isNaN(lineNum) || lineNum <= 0 || lineNum > model.getLineCount()) continue;
            if (lineNum < range.startLineNumber || lineNum > range.endLineNumber) continue;

            const maxCol = model.getLineMaxColumn(lineNum);
            hints.push({
              kind: monaco.languages.InlayHintKind.Type,
              position: { lineNumber: lineNum, column: maxCol },
              label: ` # => ${value}`,
              paddingLeft: true
            });
          }
        } catch {
          // ヒント提供失敗時は静かに終了
        }
        return { hints: hints, dispose: () => {} };
      }
    });
  }

  // 測定結果を更新し、表示をリフレッシュする
  update(line: number, value: string): void {
    this.measuredValues.set(line, value);
    this.emitter.fire();
    
    // Inlay Hints を強制的に再描画させる
    this.editor.updateOptions({ inlayHints: { enabled: "off" } });
    setTimeout(() => this.editor.updateOptions({ inlayHints: { enabled: "on", maximumLength: 150 } }), 50);
  }

  // 保持しているキャッシュをクリアする
  clear(): void {
    this.measuredValues.clear();
    this.emitter.fire();
  }
}
