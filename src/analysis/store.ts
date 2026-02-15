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
    this.methods = new Map<string, MethodItem>() // { "name:line:col": { name, line, col, status, ... } }
    this.firstScanDone = false
  }

  /**
   * メソッドの状態を更新または追加する
   */
  set(id: string, state: MethodItem): void {
    this.methods.set(id, state)
  }

  /**
   * 全てのメソッドデータを取得する
   */
  getAll(): MethodItem[] {
    return Array.from(this.methods.values())
  }

  /**
   * 一致するIDのデータを取得する
   */
  get(id: string): MethodItem | undefined {
    return this.methods.get(id)
  }

  /**
   * 指定されたリストに含まれないメソッドを削除する
   */
  keepOnly(currentIds: Set<string>): boolean {
    let changed = false
    for (const id of this.methods.keys()) {
      if (!currentIds.has(id)) {
        this.methods.delete(id)
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
