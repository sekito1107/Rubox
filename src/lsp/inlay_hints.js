import * as monaco from 'monaco-editor'

/**
 * Monaco Editor に Inlay Hints (型情報の行末表示) を提供する
 */
export class ProvideInlayHints {
  constructor(editor) {
    this.editor = editor
    this.emitter = new monaco.Emitter()
    this.measuredValues = new Map() // Key: lineNumber(1-based), Value: measured string
  }

  /**
   * プロバイダを登録する
   */
  start() {
    monaco.languages.registerInlayHintsProvider("ruby", {
      onDidChangeInlayHints: this.emitter.event,
      provideInlayHints: (model, range) => {
        const hints = []
        for (const [line, value] of this.measuredValues.entries()) {
          const lineNum = Number(line)
          if (lineNum < range.startLineNumber || lineNum > range.endLineNumber) continue
          const maxCol = model.getLineMaxColumn(lineNum)
          hints.push({
            kind: monaco.languages.InlayHintKind.Type,
            position: { lineNumber: lineNum, column: maxCol },
            label: ` # => ${value}`,
            paddingLeft: true
          })
        }
        return { hints: hints, dispose: () => {} }
      }
    })
  }

  /**
   * 測定結果を更新し、表示をリフレッシュする
   */
  update(line, value) {
    this.measuredValues.set(line, value)
    this.emitter.fire()
    
    // Inlay Hints を強制的に再描画させる
    this.editor.updateOptions({ inlayHints: { enabled: "off" } })
    setTimeout(() => this.editor.updateOptions({ inlayHints: { enabled: "on" } }), 50)
  }

  /**
   * 保持しているキャッシュをクリアする
   */
  clear() {
    this.measuredValues.clear()
    this.emitter.fire()
  }
}
