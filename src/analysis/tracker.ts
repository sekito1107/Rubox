/**
 * エディタの変更イベントを監視し、スキャンが必要な範囲やキャッシュの整合性を管理する
 */
export class Tracker {
  private dirtyLines: Set<number>

  constructor() {
    this.dirtyLines = new Set<number>()
  }

  /**
   * エディタの変更イベントから、再スキャンが必要な行を特定する
   * @param event monaco.editor.IModelContentChangedEvent 
   * @param lineMethods 
   */
  processChangeEvent(event: { changes: Array<{ range: { startLineNumber: number, endLineNumber: number }, text: string }> }, lineMethods: Array<any>): void {
    event.changes.forEach(change => {
      const startLine = change.range.startLineNumber - 1
      const endLine = change.range.endLineNumber - 1
      const newLineCount = change.text.split("\n").length
      const oldLineCount = (endLine - startLine) + 1

      // 1. 行が追加/削除された場合、キャッシュをずらす
      if (newLineCount !== oldLineCount) {
        const diff = newLineCount - oldLineCount
        if (diff > 0) {
          // 行追加: 指定位置から開始して空要素を挿入
          lineMethods.splice(startLine + 1, 0, ...new Array(diff).fill(null))
        } else {
          // 行削除: 指定位置から削除
          lineMethods.splice(startLine + 1, Math.abs(diff))
        }
      }

      // 2. 変更された行とその周辺を Dirty マーク
      for (let i = startLine; i < startLine + newLineCount; i++) {
        this.dirtyLines.add(i)
      }
    })
  }

  getDirtyLines(): Set<number> {
    return this.dirtyLines
  }

  clearDirtyLines(): void {
    this.dirtyLines.clear()
  }

  markAllDirty(lineCount: number): void {
    this.dirtyLines.clear()
    for (let i = 0; i < lineCount; i++) {
      this.dirtyLines.add(i)
    }
  }
}
