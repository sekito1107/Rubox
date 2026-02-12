import { ScannedMethod } from "./scanner"

/**
 * メソッドの解析状態を表す型定義
 */
export type MethodItem = ScannedMethod & {
  status: 'pending' | 'resolving' | 'resolved' | 'unknown'
  className?: string | null
  url?: string | null
  separator?: string
  isResolving?: boolean
}

/**
 * 解析結果（メソッドリストとその状態）を中央管理し、変更を通知する Store
 */
export class AnalysisStore {
  private methods: Map<string, MethodItem>
  public firstScanDone: boolean

  constructor() {
    this.methods = new Map<string, MethodItem>() // { メソッド名: { name, line, col, status, ... } }
    this.firstScanDone = false
  }

  /**
   * メソッドの状態を更新または追加する
   */
  set(name: string, state: MethodItem): void {
    this.methods.set(name, state)
  }

  /**
   * 全てのメソッドデータを取得する
   */
  getAll(): MethodItem[] {
    return Array.from(this.methods.values())
  }

  /**
   * 単一のメソッドデータを取得する
   */
  get(name: string): MethodItem | undefined {
    return this.methods.get(name)
  }

  /**
   * 指定されたリストに含まれないメソッドを削除する
   */
  keepOnly(currentNames: Set<string>): boolean {
    let changed = false
    for (const name of this.methods.keys()) {
      if (!currentNames.has(name)) {
        this.methods.delete(name)
        changed = true
      }
    }
    return changed
  }
  
  setFirstScanDone(done: boolean): void {
    this.firstScanDone = done
  }

  /**
   * 状態が更新されたことをシステム全体に通知する
   */
  notify(): void {
    const event = new CustomEvent("rubbit:analysis-updated", {
      detail: { 
        methods: this.getAll(),
        firstScanDone: this.firstScanDone
      }
    })
    window.dispatchEvent(event)
  }
}
